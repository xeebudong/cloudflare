
E:
cd E:\cloudflare

git pull --depth 1 origin master

git add --all
git commit -m "sync note via win"
git push

git pull --depth 1 origin master
