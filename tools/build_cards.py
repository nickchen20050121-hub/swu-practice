import csv, json, sys, re
D='/mnt/project-files/swu/data/'
allc=json.load(open(D+'swu_cards_all.json'))['cards']
art={}
pri={'Normal':0}
for c in allc:
    k=(c['Name'],c.get('Subtitle',''))
    r=pri.get(c['VariantType'],5)
    if k not in art or r<art[k][0]:
        art[k]=(r,c['FrontArt'],c.get('BackArt',''),c['Set']+'-'+c['Number'],c.get('cid',''))
out=[]
for row in csv.DictReader(open(D+'swu_cards_unique.csv',encoding='utf-8-sig')):
    k=(row['Name'],row['Subtitle'])
    a=art.get(k)
    def num(x):
        try: return int(x)
        except: return None
    ent={
     'id':a[3] if a else '', 'n':row['Name'],'s':row['Subtitle'],'t':row['Type'],
     'a':[x.strip() for x in row['Aspects'].split('/') if x.strip()],
     'c':num(row['Cost']),'p':num(row['Power']),'h':num(row['HP']),
     'ar':row['Arenas'],'tr':[x.strip() for x in row['Traits'].split('/') if x.strip()],
     'kw':[x.strip() for x in re.split('[/,]',row['Keywords']) if x.strip()],
     'u':row['Unique']=='True','tx':row['FrontText'],'ep':row['EpicAction'],'bt':row['BackText'],
     'img':a[1] if a else '','bimg':a[2] if a else '',
     'pl':row['Premier_Legal'],'pr':row['CheapestNormal'],
     'ids':[re.sub(r'\(.*\)','',x).strip() for x in row['Printings'].split(';') if x.strip()],
     'sets':row['Sets'],
    }
    ent={k:v for k,v in ent.items() if v not in ('',None,[],False)}
    out.append(ent)
open('cards.js','w').write('window.SWU_CARDS='+json.dumps(out,ensure_ascii=False,separators=(',',':'))+';')
print(len(out))
