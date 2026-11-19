#!/bin/bash
# 只读：按平台正确 shop id 复测 shop 维度端点
COOKIE=$(curl -s -c - -H 'Content-Type: application/json' -d '{"username":"admin","password":"Admin@123456"}' http://localhost:8788/api/v1/auth/login | awk '/leyova_session/{print "leyova_session="$7}')
out=shop_scoped.tsv; : > $out
probe(){ c=$(curl -s -m 10 -o /tmp/s.json -w '%{http_code}' -H "Cookie: $COOKIE" "http://localhost:8788$1"); echo -e "$c\t$1\t$(head -c 200 /tmp/s.json)" >> $out; }
for id in 1 2 3; do probe "/api/v1/douyin/shop/$id/metrics"; probe "/api/v1/douyin/shop/$id/channels"; probe "/api/v1/douyin/shop/$id/anchors"; done
for id in 4 5 6; do probe "/api/v1/kuaishou/shop/$id/traffic-split"; probe "/api/v1/kuaishou/shop/$id/indirect-gmv"; probe "/api/v1/kuaishou/shop/$id/fans"; probe "/api/v1/kuaishou/shop/$id/ad-roi"; done
for id in 10 11 12; do probe "/api/v1/taobao/shop/$id/metrics"; probe "/api/v1/taobao/shop/$id/products"; probe "/api/v1/taobao/shop/$id/channels"; probe "/api/v1/taobao/shop/$id/ad-reconciliation"; probe "/api/v1/taobao/shop/$id/dsr"; done
for id in 13 14 15; do probe "/api/v1/tmall/shop/$id/overview"; done
for id in 7 8 9; do probe "/api/v1/wechat/shop/$id/overview"; done
for id in 16 17 18; do probe "/api/v1/omnichannel/shop/$id/products"; done
for code_id in "douyin 1" "kuaishou 4" "taobao 10"; do set -- $code_id; probe "/api/v1/platforms/$1/shops/$2/credentials"; done
cat $out
