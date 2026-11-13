const K=new Set(`iljtfrI.,;:!|'"() -`.split("")),Z=new Set("mwMW@%".split(""));function q(t,a){let s=.556;return K.has(t)?s=.3:Z.has(t)?s=.85:t>="A"&&t<="Z"?s=.68:t>="0"&&t<="9"&&(s=.556),a?s*1.06:s}function y(t,a,s=!1){let c=0;for(const r of t)c+=q(r,s);return c*a}function z(t,a,s,c=!1){if(y(t,s,c)<=a)return t;let r=t;for(;r.length>1&&y(`${r}…`,s,c)>a;)r=r.slice(0,-1);return`${r}…`}const j={"€":128,"‚":130,"„":132,"…":133,"‘":145,"’":146,"“":147,"”":148,"•":149,"–":150,"—":151,"™":153};function H(t){let a="";for(const s of t){const c=s.codePointAt(0);let r;j[s]!==void 0?r=j[s]:s==="−"?r=45:s==="✓"?r=118:c<256?r=c:r=63;const o=String.fromCharCode(r);a+=o==="("||o===")"||o==="\\"?`\\${o}`:o}return a}const I=t=>t==null?"":typeof t=="number"?t.toLocaleString("es-ES",{maximumFractionDigits:2}):String(t);function J(t,a){var v;const s=t.headers.length>6,c=s?842:595,r=s?595:842,o=36,p=t.headers.length>9?7:8,d=p+6,m=c-2*o,D=[t.headers,...t.rows.slice(0,200),...t.totals||[]],S=t.headers.map((e,n)=>Math.min(220,Math.max(30,...D.map((l,u)=>y(I(l[n]??""),p,u===0)+8)))),L=S.reduce((e,n)=>e+n,0),_=S.map(e=>e/L*m),G=t.headers.map((e,n)=>t.rows.length>0&&t.rows.every(l=>l[n]===null||l[n]===void 0||l[n]===""||typeof l[n]=="number")),x=[];let F=[],i=0;const h=(e,n,l,u,g=!1)=>F.push(`BT /${g?"F2":"F1"} ${u} Tf ${n.toFixed(2)} ${l.toFixed(2)} Td (${H(e)}) Tj ET`),R=(e,n,l,u,g)=>F.push(`${g} g ${e.toFixed(2)} ${n.toFixed(2)} ${l.toFixed(2)} ${u.toFixed(2)} re f 0 g`),A=(e,n,l,u)=>F.push(`0.6 w ${e.toFixed(2)} ${n.toFixed(2)} m ${l.toFixed(2)} ${u.toFixed(2)} l S`),w=(e,n,l)=>{l!==null&&R(o,i-3,m,d,l);let u=o;e.forEach((g,M)=>{const E=_[M]||0,N=z(I(g),E-6,p,n),k=G[M]&&typeof g=="number"?u+E-3-y(N,p,n):u+3;h(N,k,i,p,n),u+=E}),i-=d},T=e=>{i=r-o,e?(h(a.farmName,o,i-10,14,!0),i-=28,h(t.title,o,i,12,!0),i-=15,t.subtitle&&(h(t.subtitle,o,i,9),i-=12),h(`Generado el ${a.generatedAt} por ${a.generatedBy}`,o,i,8),i-=16):(h(`${a.farmName} · ${t.title} (continuación)`,o,i-8,9,!0),i-=24),R(o,i-4,m,d+2,.82),w(t.headers,!0,null),A(o,i+d-3,o+m,i+d-3)},b=()=>{x.push(F.join(`
`)),F=[]};T(!0),t.rows.length||(h("Sin datos para este reporte.",o,i,9),i-=d),t.rows.forEach((e,n)=>{i<o+24&&(b(),T(!1)),w(e,!1,n%2===1?.94:null)}),(v=t.totals)!=null&&v.length&&(i<o+24+d*t.totals.length&&(b(),T(!1)),A(o,i+d-3,o+m,i+d-3),t.totals.forEach(e=>w(e,!0,null))),b();const B=x.length,P=x.map((e,n)=>`${e}
BT /F1 7 Tf ${o} ${o-18} Td (${H(`Página ${n+1} de ${B} · ${a.farmName} · Gestión Pecuaria`)}) Tj ET`),f=[];f[1]="<< /Type /Catalog /Pages 2 0 R >>";const O=P.map((e,n)=>`${5+n*2} 0 R`).join(" ");f[2]=`<< /Type /Pages /Kids [${O}] /Count ${B} >>`,f[3]="<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",f[4]="<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",P.forEach((e,n)=>{const l=5+n*2;f[l]=`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${c} ${r}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${l+1} 0 R >>`,f[l+1]=`<< /Length ${e.length} >>
stream
${e}
endstream`});let $=`%PDF-1.4
%âãÏÓ
`;const W=[];for(let e=1;e<f.length;e++)W[e]=$.length,$+=`${e} 0 obj
${f[e]}
endobj
`;const U=$.length;$+=`xref
0 ${f.length}
0000000000 65535 f 
`;for(let e=1;e<f.length;e++)$+=`${String(W[e]).padStart(10,"0")} 00000 n 
`;$+=`trailer
<< /Size ${f.length} /Root 1 0 R >>
startxref
${U}
%%EOF
`;const C=new Uint8Array($.length);for(let e=0;e<$.length;e++)C[e]=$.charCodeAt(e)&255;return C}function Q(t,a){const s=J(t,a),c=new ArrayBuffer(s.byteLength);return new Uint8Array(c).set(s),new Blob([c],{type:"application/pdf"})}export{J as buildPdf,Q as pdfBlob,y as textWidth};
