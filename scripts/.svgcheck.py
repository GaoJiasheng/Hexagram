import json,glob,re,sys,xml.etree.ElementTree as ET
def chk(f):
    a=json.load(open(f)); bad=[]
    for bi,b in enumerate(a.get('blocks',[])):
        sv=b.get('svg')
        if not sv: continue
        m=re.search(r'viewBox=["\']([\d\.\s\-]+)["\']',sv)
        if not m: bad.append((bi,'no viewBox')); continue
        x0,y0,W,H=[float(v) for v in m.group(1).split()]
        try: root=ET.fromstring(sv)
        except Exception as e: bad.append((bi,'XML '+str(e))); continue
        for el in root.iter():
            t=el.tag.split('}')[-1]
            def F(k,d=0):
                try: return float(el.get(k,d))
                except: return d
            if t=='text':
                fs=F('font-size',14)
                y=F('y'); x=F('x')
                s=(el.text or '')
                w=sum(fs if ord(c)>0x2e80 else fs*0.55 for c in s)
                anc=el.get('text-anchor','start')
                x1 = x - w/2 if anc=='middle' else (x-w if anc=='end' else x)
                x2 = x1+w
                if y+fs*0.28 > y0+H+0.5 or y-fs*0.8 < y0-0.5 or x1 < x0-0.5 or x2 > x0+W+0.5:
                    bad.append((bi,f'text 越界 "{s[:14]}" x[{x1:.0f},{x2:.0f}] y{y} vb {W}x{H}'))
            elif t=='rect':
                if F('x')<x0-.5 or F('y')<y0-.5 or F('x')+F('width')>x0+W+.5 or F('y')+F('height')>y0+H+.5:
                    bad.append((bi,f'rect 越界 {el.get("x")},{el.get("y")} {el.get("width")}x{el.get("height")}'))
            elif t=='circle':
                if F('cy')+F('r')>y0+H+.5 or F('cx')+F('r')>x0+W+.5 or F('cx')-F('r')<x0-.5 or F('cy')-F('r')<y0-.5:
                    bad.append((bi,'circle 越界'))
            elif t=='line':
                for k in ('x1','x2'):
                    if F(k)<x0-.5 or F(k)>x0+W+.5: bad.append((bi,'line x 越界'))
                for k in ('y1','y2'):
                    if F(k)<y0-.5 or F(k)>y0+H+.5: bad.append((bi,'line y 越界'))
    return bad
for f in sys.argv[1:]:
    b=chk(f)
    print(('✗ ' if b else '✓ ')+f)
    for x in b[:12]: print('   ',x)
