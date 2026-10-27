from PIL import Image, ImageDraw, ImageFilter, ImageEnhance
import sys
A='/mnt/user-data/attachments/3dde8e64-04eb-5af1-bcfb-a770c09631ee/'
# code, file, cx, cy, side  (coordonnees de l'image affichee: 2000 de large)
B=[('meals_30','f8b78cbe',1000,1020,1760),('meals_100','49ab08cb',1000,1015,1800),('first_pr','a84a8906',1000,990,1780),('sessions_365','1bfabf54',1000,600,1210),('streak_150','44fe1bd1',1000,650,1180),('streak_100','5dc04e94',1000,600,1180),
('streak_75','dd9de68f',1034,880,1720),('streak_50','652a79e9',1034,880,1660),('visits_365','9f0dd8d1',1034,920,1700),
('visits_100','011ae653',1034,890,1760),('visits_50','c689e7a4',1034,880,1640),('visits_10','90e403cd',1034,870,1600),
('streak_30','b2a66b74',1034,856,1627),('streak_15','d5f16d9f',1034,900,1560),('streak_7','c89f3022',1000,630,1120),
('streak_3','d2188b91',1034,880,1640),('streak_1','0247d0d2',1034,963,1520),('sessions_500','96e37c18',1034,880,1560),
('sessions_1','cc607f63',1000,665,1240),('sessions_100','da2fe2e0',1000,610,1220),('sessions_50','d8b66f6d',1000,660,1230),
('sessions_25','db1f3d22',1000,655,1200),('sessions_10','63a217f7',1000,665,1230)]
N=400
def vign(n):
    m=Image.new('L',(n,n),0); d=ImageDraw.Draw(m)
    for i in range(60):
        r=n*0.5*(1.0-i/60*0.0)  # placeholder
    m=Image.radial_gradient('L').resize((n,n))  # 0 centre -> 255 bords
    return m
out=[]
for code,f,cx,cy,side in B:
    im=Image.open(A+f+'-image.jpg').convert('RGB'); s=im.width/2000 if im.width==2400 else 1
    l,t=(cx-side/2)*s,(cy-side/2)*s; r,b=l+side*s,t+side*s
    if t<0: b-=t; t=0
    if l<0: r-=l; l=0
    c=im.crop((round(l),round(t),round(r),round(b))).resize((N,N),Image.LANCZOS)
    c=ImageEnhance.Sharpness(c).enhance(1.25); c=ImageEnhance.Contrast(c).enhance(1.05)
    # bords fondus vers le noir de l'app (#0B0B0A) pour que le fond se marie a l'ecran
    g=Image.radial_gradient('L').resize((N,N))           # 0 au centre, 255 aux bords
    g=g.point(lambda v: 0 if v<150 else min(255,int((v-150)*2.4)))
    bg=Image.new('RGB',(N,N),(11,11,10)); c=Image.composite(bg,c,g)
    c.save(code+'.webp','WEBP',quality=80,method=6); out.append((code,c))
S=Image.new('RGB',(5*260,4*280),'white'); d=ImageDraw.Draw(S)
for i,(code,c) in enumerate(out):
    x,y=(i%5)*260,(i//5)*280; S.paste(c.resize((256,256)),(x,y+20)); d.text((x+4,y+4),code,fill='black')
S.save('/tmp/claude-0/-home-claude/3dde8e64-04eb-5af1-bcfb-a770c09631ee/scratchpad/badges_sheet.png')
