# -*- coding: utf-8 -*-
"""Preprocess world cup data into JSON for the static website."""
import pandas as pd, json, numpy as np

DATA = "D:/claude/vibecoding/worldcup-static/data/"
OUT = DATA

df = pd.read_csv(DATA + "fifa_worldcup_matches_concat_etl.csv")
df["game week"] = df["game week"].fillna(4)
df['year'] = df['year'].astype(int)
df['stage'] = df['game week'].map({1.0: '小组赛R1', 2.0: '小组赛R2', 3.0: '小组赛R3', 4.0: '淘汰赛'})

CONT = sorted(set(df["home_continent"]).union(set(df["away_continent"])))
CN = {'Europe': '欧洲', 'South America': '南美洲', 'Africa': '非洲',
      'Asia': '亚洲', 'North America': '北美洲', 'Oceania': '大洋洲'}
CN_REV = {v: k for k, v in CN.items()}
CONT_CN = [CN[c] for c in CONT]
YEARS = sorted(df['year'].unique().astype(int).tolist())

# ============================================================
# 1. Heatmap data — overall + by year
# ============================================================
def build_heatmap(df_in):
    hh = df_in.copy()
    swap = hh["home_team_goal_count"] < hh["away_team_goal_count"]
    for a, b in [("home_continent", "away_continent"), ("home_team_goal_count", "away_team_goal_count")]:
        hh.loc[swap, [a, b]] = hh.loc[swap, [b, a]].to_numpy()
    hh["is_win"] = hh["home_team_goal_count"] > hh["away_team_goal_count"]
    st = hh.groupby(["home_continent", "away_continent"], as_index=False).agg(
        cnt=("is_win", "size"), win=("is_win", "sum"))
    mw = st.pivot(index="home_continent", columns="away_continent", values="win")
    mc = st.pivot(index="home_continent", columns="away_continent", values="cnt")
    mc_s = mc.add(mc.T, fill_value=0)
    for c in CONT:
        mask = (hh["home_continent"] == c) & (hh["away_continent"] == c)
        if mask.sum() > 0:
            mc_s.loc[c, c] = mask.sum()
    mr = (mw / mc_s).rename(index=CN, columns=CN)
    mc_z = mc_s.rename(index=CN, columns=CN)
    # Build z-matrix (win rate), annotation matrix, and count matrix
    z_data = []
    ann_data = []
    cnt_data = []
    for ci in CONT_CN:
        z_row, ann_row, cnt_row = [], [], []
        for cj in CONT_CN:
            r = mr.loc[ci, cj] if ci in mr.index and cj in mr.columns else np.nan
            cv = mc_z.loc[ci, cj] if ci in mc_z.index and cj in mc_z.columns else 0
            z_row.append(round(float(r), 4) if not pd.isna(r) else None)
            ann_row.append(f"{r:.1%}<br>({int(cv)}场)" if not pd.isna(r) and cv > 0 else "")
            cnt_row.append(int(cv) if not pd.isna(cv) else 0)
        z_data.append(z_row)
        ann_data.append(ann_row)
        cnt_data.append(cnt_row)
    return {"continents": CONT_CN, "z": z_data, "annotations": ann_data, "counts": cnt_data}

heatmap_overall = build_heatmap(df)

heatmap_by_year = {}
for y in YEARS:
    heatmap_by_year[str(y)] = build_heatmap(df[df["year"] == y])

# ============================================================
# 2. Stats table data — by continent, year, stage
# ============================================================
def align(df_in, target):
    s = df_in[(df_in["home_continent"] == target) | (df_in["away_continent"] == target)].copy()
    swap_mask = s["home_continent"] != target
    for a, b in [("home_continent", "away_continent"), ("home_team_goal_count", "away_team_goal_count"),
                 ("odds_ft_home_team_win", "odds_ft_away_team_win")]:
        if a in s.columns and b in s.columns:
            s.loc[swap_mask, [a, b]] = s.loc[swap_mask, [b, a]].to_numpy()
    s["result"] = s.apply(lambda x: "W" if x["home_team_goal_count"] > x["away_team_goal_count"]
                          else "D" if x["home_team_goal_count"] == x["away_team_goal_count"] else "L", axis=1)
    return s

# Build detailed stats: home_continent -> [year -> away_continent -> stage-level data]
stats_detail = {}
for cont in CONT:
    sub = align(df, cont)
    cont_cn = CN[cont]
    cont_data = {"summary": {}}

    # Summary by away_continent (all years), including intra-continent
    for opp in CONT:
        so = sub[sub["away_continent"] == opp]
        t = len(so)
        if t == 0:
            continue
        w = (so["result"] == "W").sum()
        d = (so["result"] == "D").sum()
        l = (so["result"] == "L").sum()
        cont_data["summary"][CN[opp]] = {
            "total": t, "win": int(w), "draw": int(d), "lose": int(l),
            "win_rate": round(w / t, 4), "draw_rate": round(d / t, 4), "lose_rate": round(l / t, 4)
        }

    # By year -> away_continent -> stage
    for y in YEARS:
        sy = sub[sub["year"] == y]
        if len(sy) == 0:
            continue
        year_key = str(y)
        cont_data[year_key] = {}
        for opp in CONT:
            so = sy[sy["away_continent"] == opp]
            t = len(so)
            if t == 0:
                continue
            w = (so["result"] == "W").sum()
            d = (so["result"] == "D").sum()
            l = (so["result"] == "L").sum()
            entry = {
                "total": t, "win": int(w), "draw": int(d), "lose": int(l),
                "win_rate": round(w / t, 4), "draw_rate": round(d / t, 4), "lose_rate": round(l / t, 4),
                "stages": {}
            }
            # By stage within year/opponent
            for gw, sn in {1.0: "小组赛R1", 2.0: "小组赛R2", 3.0: "小组赛R3", 4.0: "淘汰赛"}.items():
                ss = so[so["game week"] == gw]
                st = len(ss)
                if st == 0:
                    continue
                sw = (ss["result"] == "W").sum()
                sd = (ss["result"] == "D").sum()
                sl = (ss["result"] == "L").sum()
                entry["stages"][sn] = {
                    "total": st, "win": int(sw), "draw": int(sd), "lose": int(sl),
                    "win_rate": round(sw / st, 4), "draw_rate": round(sd / st, 4), "lose_rate": round(sl / st, 4)
                }
            cont_data[year_key][CN[opp]] = entry

    stats_detail[cont_cn] = cont_data

# ============================================================
# 3. Match query data — compact match list
# ============================================================
matches = []
for _, r in df.iterrows():
    matches.append({
        "year": int(r["year"]),
        "stage": r["stage"],
        "home_team": r["home_team_name"],
        "away_team": r["away_team_name"],
        "home_goals": int(r["home_team_goal_count"]),
        "away_goals": int(r["away_team_goal_count"]),
        "home_cont": CN[r["home_continent"]],
        "away_cont": CN[r["away_continent"]],
        "home_odds": round(float(r["odds_ft_home_team_win"]), 2) if pd.notna(r["odds_ft_home_team_win"]) and r["odds_ft_home_team_win"] > 0 else None,
        "draw_odds": round(float(r["odds_ft_draw"]), 2) if pd.notna(r.get("odds_ft_draw")) and r.get("odds_ft_draw", 0) > 0 else None,
        "away_odds": round(float(r["odds_ft_away_team_win"]), 2) if pd.notna(r["odds_ft_away_team_win"]) and r["odds_ft_away_team_win"] > 0 else None,
        "stadium": r.get("stadium_name", "") if pd.notna(r.get("stadium_name", "")) else "",
        "attendance": int(r["attendance"]) if pd.notna(r.get("attendance")) else None,
    })

# ============================================================
# 4. FIFA rankings
# ============================================================
dr = pd.read_csv(DATA + "fifa_worldcup_rank.csv")
rankings = {}
for _, r in dr.iterrows():
    year = str(int(r["Year"]))
    if year not in rankings:
        rankings[year] = {}
    rankings[year][r["Country"]] = {"rank": int(r["FIFA_Rank"]), "cn": r["Country_Chinese"]}

# ============================================================
# 5. Continent aggregated summary for the overview table
# ============================================================
agg_summary = {}
for cont in CONT:
    sub = align(df, cont)
    t = len(sub)
    w = (sub["result"] == "W").sum()
    d = (sub["result"] == "D").sum()
    l = (sub["result"] == "L").sum()
    opp_stats = {}
    for opp in CONT:
        so = sub[sub["away_continent"] == opp]
        ot = len(so)
        if ot > 0:
            ow = (so["result"] == "W").sum()
            opp_stats[CN[opp]] = {"total": ot, "win_rate": round(ow / ot, 4)}
    agg_summary[CN[cont]] = {
        "total": t, "win": int(w), "draw": int(d), "lose": int(l),
        "win_rate": round(w / t, 4), "draw_rate": round(d / t, 4), "lose_rate": round(l / t, 4),
        "opponents": opp_stats
    }

# Year-specific overview for reactive summary table
agg_summary_by_year = {}
for y in YEARS:
    dy = df[df["year"] == y]
    year_data = {}
    for cont in CONT:
        sub = align(dy, cont)
        t = len(sub)
        if t == 0:
            continue
        w = (sub["result"] == "W").sum()
        d = (sub["result"] == "D").sum()
        l = (sub["result"] == "L").sum()
        opp_stats = {}
        for opp in CONT:
            so = sub[sub["away_continent"] == opp]
            ot = len(so)
            if ot > 0:
                ow = (so["result"] == "W").sum()
                opp_stats[CN[opp]] = {"total": ot, "win_rate": round(ow / ot, 4)}
        year_data[CN[cont]] = {
            "total": t, "win": int(w), "draw": int(d), "lose": int(l),
            "win_rate": round(w / t, 4), "draw_rate": round(d / t, 4), "lose_rate": round(l / t, 4),
            "opponents": opp_stats
        }
    agg_summary_by_year[str(y)] = year_data

# ============================================================
# Write all JSON
# ============================================================
output = {
    "continents": CONT_CN,
    "continents_en": CONT,
    "years": YEARS,
    "heatmap_overall": heatmap_overall,
    "heatmap_by_year": heatmap_by_year,
    "stats_detail": stats_detail,
    "matches": matches,
    "rankings": rankings,
    "agg_summary": agg_summary,
    "agg_summary_by_year": agg_summary_by_year,
}

with open(OUT + "worldcup_data.json", "w", encoding="utf-8") as f:
    json.dump(output, f, ensure_ascii=False)

print(f"JSON data written to {OUT}worldcup_data.json")
print(f"  {len(matches)} matches, {len(YEARS)} years, {len(CONT)} continents")
print(f"  File size: {len(json.dumps(output, ensure_ascii=False))} chars")
