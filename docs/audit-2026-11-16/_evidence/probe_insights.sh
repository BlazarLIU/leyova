#!/bin/bash
COOKIE=$(curl -s -D - -o /dev/null -H 'Content-Type: application/json' -d '{"username":"admin","password":"Admin@123456"}' http://localhost:8788/api/v1/auth/login | awk -F'leyova_session=' '/set-cookie/{split($2,a,";");print "leyova_session="a[1]}' | head -1)
echo "path|status|bytes|body"
for p in /insights/douyin/three-pools /insights/taobao/three-sources /tmall/brands /tmall/promotion-layers /tmall/promo-compare /insights/xiaohongshu/buyer-profile /insights/xiaohongshu/dandelion /insights/xiaohongshu/traffic-sources /wechat/affiliate /wechat/content; do
  code=$(curl -s -m 12 -o /tmp/i.json -w '%{http_code}' -H "Cookie: $COOKIE" "http://localhost:8788/api/v1$p")
  echo "$p|$code|$(wc -c </tmp/i.json)|$(head -c 150 /tmp/i.json)"
done
