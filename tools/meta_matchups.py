# 比賽對戰勝率分析：先下載 swumetastats /api/matchups 的 JSON，再 python tools/meta_matchups.py matchups.json
# 會印出主流領袖勝率、Luke | I Can Save Him 對各領袖、各基地勝率（改 luke= 那行可換領袖）
import json,sys,collections,math
d=json.load(open(sys.argv[1],encoding='utf-8'))['matchups']
L=collections.defaultdict(lambda:[0,0]); M=collections.defaultdict(lambda:[0,0])
for m in d:
    if m['leader']==m['opponentLeader']: continue
    L[m['leader']][0]+=m['gameWins']; L[m['leader']][1]+=m['gameLosses']
    M[(m['leader'],m['opponentLeader'])][0]+=m['gameWins']; M[(m['leader'],m['opponentLeader'])][1]+=m['gameLosses']
sys.stdout.reconfigure(encoding='utf-8')
print("== leaders by games (game win rate, ±95%)")
for k,(w,l) in sorted(L.items(),key=lambda x:-sum(x[1]))[:20]:
    n=w+l; p=w/n; print(f"{k[:45]:45} {n:5} {p:.1%} ±{1.96*math.sqrt(p*(1-p)/n):.1%}")
luke='Luke Skywalker | I Can Save Him'
print("\n== Luke ICSH vs leaders (n>=15)")
rows=[(o,w,l) for (a,o),(w,l) in M.items() if a==luke and w+l>=15]
for o,w,l in sorted(rows,key=lambda r:r[1]/(r[1]+r[2])):
    n=w+l; p=w/n; print(f"{o[:45]:45} {n:4} {p:.1%} ±{1.96*math.sqrt(p*(1-p)/n):.1%}")
b=collections.defaultdict(lambda:[0,0])
for m in d:
    if m['leader']==luke and m['opponentLeader']!=luke: b[m['base']][0]+=m['gameWins']; b[m['base']][1]+=m['gameLosses']
print("\n== Luke ICSH by base"); [print(k,w+l,f"{w/(w+l):.1%}") for k,(w,l) in sorted(b.items(),key=lambda x:-sum(x[1]))[:6]]
