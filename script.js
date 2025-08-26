/* =========================
   Paleta p/ PDF e UI
   ========================= */
const THEME = {
  brand: "#E1262D",   // vermelho Chiva
  brandWeak: "#E6F7FF",
  ink: "#0F1E3D",
  muted: "#5C6B84",
  border: "#E2E8F0",
  sea: "#0077B6",     // azul da onda
  success: "#22C55E",
  danger: "#E11D48",
};

/* ======= Normas (combo) ======= */
const NORMAS_OPCOES = [
  "ABNT NBR 5648:2018",
  "ABNT NBR 8219",
  "ABNT NBR NM 82",
  "EN 62321-3-1:2014",
  "ABNT NBR NM 84",
  "ABNT NBR 8218",
  "ABNT NBR 14264",
  "ABNT NBR 7371",
];

/* ======= Ensaios ======= */
const ENSAIOS_DEFAULT = [
  { ensaio: "Efeito sobre a água (Inocuidade)", norma: "ABNT NBR 8219" },
  { ensaio: "Temperatura de amolecimento Vicat", norma: "ABNT NBR NM 82" },
  { ensaio: "Presença de chumbo", norma: "EN 62321-3-1:2014" },
  { ensaio: "Teor de cinzas", norma: "ABNT NBR NM 84" },
  { ensaio: "Resistência à pressão hidrostática interna", norma: "ABNT NBR 8218" },
  { ensaio: "Características geométricas", norma: "ABNT NBR 14264" },
  { ensaio: "Desempenho da junta soldável", norma: "ABNT NBR 7371" },
];

const STORAGE_KEY = "relatorios-ensaio-v3";

/* ======= Helpers ======= */
const $  = (sel, ctx=document) => ctx.querySelector(sel);
const $$ = (sel, ctx=document) => Array.from(ctx.querySelectorAll(sel));
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())+Math.random());
const el  = (t,c,h)=>{ const e=document.createElement(t); if(c) e.className=c; if(h!=null) e.innerHTML=h; return e; };
const splitList = s => (s||"").split(";").map(x=>x.trim()).filter(Boolean);
const sanitizeFileName = s => (s||"ensaio").replace(/[^\p{L}\p{N}\-_.]+/gu,"-").replace(/-+/g,"-").replace(/(^-|-$)/g,"");

/* ======= Estado ======= */
let relatorios = loadAll();
let atual = novoRelatorio();

/* ======= Init ======= */
document.addEventListener("DOMContentLoaded", () => {
  $("#ano").textContent = new Date().getFullYear();

  montarNormasSelect();
  montarMetodos();
  preencherForm(atual);
  desenharLista();

  // layout
  $("#btnToggleAside")?.addEventListener("click", ()=>document.body.classList.toggle("aside-collapsed"));

  // normas
  $("#btnAddNorma")?.addEventListener("click", addNormaCustom);

  // itens dinâmicos
  $("#btnAddAmostra")?.addEventListener("click", addAmostra);
  $("#btnAddResultado")?.addEventListener("click", addResultado);
  $("#btnAddImagem")?.addEventListener("click", addImagem);
  $("#btnAddTabela")?.addEventListener("click", addTabela);

  // ações principais
  $("#btnNovo").addEventListener("click", ()=>{ atual = novoRelatorio(); preencherForm(atual); });
  $("#btnSalvar").addEventListener("click", salvarAtual);
  $("#btnExportar").addEventListener("click", exportarJSON);
  $("#inputImportar").addEventListener("change", importarJSON);
  $("#btnImprimir").addEventListener("click", ()=>window.print());

  // PDFs
  $("#btnPDF").addEventListener("click", gerarPDF);
  $("#btnPDFhtml").addEventListener("click", gerarPDFhtml);

  // filtro da lista
  $("#filtroLista").addEventListener("input", desenharLista);
});

/* ======= Modelo ======= */
function novoRelatorio(){
  return {
    id: uid(),
    numeroRelatorio: "",
    revisao: "",
    dataEmissao: "",
    responsavelTecnico: "",
    laboratorio: "",
    normasReferencia: [],              // multi-select
    amostras: [novaAmostra()],
    objetivo: "",
    metodos: ENSAIOS_DEFAULT.map(m=>({...m, aplicado:false})),
    resultados: [],
    discussao: "",
    conclusao: { status:"Conforme", observacoes:"" },
    anexos: { certificados:[], planilhas:[], fotos:[] },
    imagens: [],                       // [{src, alt, legenda}]
    tabelasExtras: [],                 // [{titulo, linhas:[[c1,c2],...]}]
    updatedAt: Date.now(),
  };
}
function novaAmostra(){ return { descricao:"", tipo:"", dimensao:"", cor:"", processo:"", marca:"", lote:"", quantidade:"" }; }
function loadAll(){ try{ return JSON.parse(localStorage.getItem(STORAGE_KEY))||[] }catch{ return [] } }
function persistAll(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(relatorios)); }
function salvarAtual(){
  if(!$("#formRelatorio").reportValidity()) return;
  const data=coletarForm(); data.updatedAt=Date.now();
  const ix=relatorios.findIndex(r=>r.id===data.id);
  if(ix>=0) relatorios[ix]=data; else relatorios.unshift(data);
  persistAll(); desenharLista(); alert("Relatório salvo!");
}

/* ======= Normas: combo ======= */
function montarNormasSelect(){
  const sel = $("#normasSelect");
  sel.innerHTML = "";
  NORMAS_OPCOES.forEach(n=>{
    const opt = el("option","",n); opt.value = n; sel.appendChild(opt);
  });
}
function setNormasSelecionadas(valores=[]){
  const sel = $("#normasSelect"); const set = new Set(valores);
  $$("option", sel).forEach(o => o.selected = set.has(o.value));
}
function getNormasSelecionadas(){
  return Array.from($("#normasSelect").selectedOptions).map(o=>o.value);
}
function addNormaCustom(){
  const inp = $("#novaNorma");
  const valor = (inp.value||"").trim();
  if(!valor) return;
  const sel = $("#normasSelect");
  let opt = Array.from(sel.options).find(o=>o.value.toLowerCase()===valor.toLowerCase());
  if(!opt){
    opt = document.createElement("option");
    opt.value = valor; opt.textContent = valor;
    sel.appendChild(opt);
  }
  opt.selected = true;   // já marca selecionada
  inp.value = "";
}

/* ======= Form <-> Estado ======= */
function preencherForm(r){
  const f=$("#formRelatorio");
  f.numeroRelatorio.value=r.numeroRelatorio||"";
  f.revisao.value=r.revisao||"";
  f.dataEmissao.value=r.dataEmissao||"";
  f.responsavelTecnico.value=r.responsavelTecnico||"";
  f.laboratorio.value=r.laboratorio||"";
  setNormasSelecionadas(r.normasReferencia||[]);
  f.objetivo.value=r.objetivo||"";
  f.discussao.value=r.discussao||"";
  f.statusConclusao.value=r.conclusao?.status||"Conforme";
  f.conclusaoObs.value=r.conclusao?.observacoes||"";
  f.anexosCertificados.value=(r.anexos?.certificados||[]).join("; ");
  f.anexosPlanilhas.value=(r.anexos?.planilhas||[]).join("; ");
  f.anexosFotos.value=(r.anexos?.fotos||[]).join("; ");
  f.id.value=r.id;

  // Amostras
  $("#amostras").innerHTML=""; (r.amostras||[]).forEach((a,i)=>$("#amostras").appendChild(amostraCard(a,i)));

  // Métodos
  montarMetodos(r.metodos);

  // Resultados
  $("#tblResultados tbody").innerHTML="";
  (r.resultados||[]).forEach(row=>$("#tblResultados tbody").appendChild(resultadoRow(row)));

  // Imagens
  $("#imagens").innerHTML=""; (r.imagens||[]).forEach(img=>$("#imagens").appendChild(imagemCard(img)));

  // Tabelas extras
  $("#tabelasExtras").innerHTML=""; (r.tabelasExtras||[]).forEach(tbl=>$("#tabelasExtras").appendChild(tabelaCard(tbl)));
}

function coletarForm(){
  const f=$("#formRelatorio");
  return {
    id:f.id.value||uid(),
    numeroRelatorio:f.numeroRelatorio.value.trim(),
    revisao:f.revisao.value.trim(),
    dataEmissao:f.dataEmissao.value,
    responsavelTecnico:f.responsavelTecnico.value.trim(),
    laboratorio:f.laboratorio.value.trim(),
    normasReferencia:getNormasSelecionadas(),

    amostras: $$("[data-amostra]",$("#amostras")).map(card=>({
      descricao:$(".a-descricao",card).value.trim(),
      tipo:$(".a-tipo",card).value.trim(),
      dimensao:$(".a-dimensao",card).value.trim(),
      cor:$(".a-cor",card).value.trim(),
      processo:$(".a-processo",card).value.trim(),
      marca:$(".a-marca",card).value.trim(),
      lote:$(".a-lote",card).value.trim(),
      quantidade:$(".a-quantidade",card).value.trim()
    })),

    objetivo:f.objetivo.value.trim(),
    metodos:$$("#metodos .metodo").map((m,i)=>({...ENSAIOS_DEFAULT[i], aplicado:$("input",m).checked})),
    resultados:$$("#tblResultados tbody tr").map(tr=>({
      ensaio:$(".r-ensaio",tr).value.trim(),
      resultado:$(".r-resultado",tr).value.trim(),
      requisito:$(".r-requisito",tr).value.trim(),
      conformidade:$(".r-conf",tr).value
    })),
    discussao:f.discussao.value.trim(),
    conclusao:{ status:f.statusConclusao.value, observacoes:f.conclusaoObs.value.trim() },
    anexos:{
      certificados:splitList(f.anexosCertificados.value),
      planilhas:splitList(f.anexosPlanilhas.value),
      fotos:splitList(f.anexosFotos.value),
    },

    imagens: $$("[data-img]").map(w=>({
      src:$(".img-url",w).value.trim(),
      alt:$(".img-alt",w)?.value.trim(),
      legenda:$(".img-cap",w)?.value.trim()
    })).filter(i=>i.src),

    tabelasExtras: $$("[data-tabela]").map(box=>({
      titulo:$(".tb-title",box).value.trim(),
      linhas: $$("tbody tr",box).map(tr=>[
        (tr.cells[0]?.innerText||"").trim(),
        (tr.cells[1]?.innerText||"").trim()
      ])
    })),

    updatedAt:Date.now()
  };
}

/* ======= UI builders ======= */
function montarMetodos(existing=[]){
  const wrap=$("#metodos"); wrap.innerHTML="";
  ENSAIOS_DEFAULT.forEach((m,i)=>{
    const lab=el("label","metodo",`<input type="checkbox"><span><strong>${m.ensaio}</strong> — <em>${m.norma}</em></span>`);
    const chk = $("input",lab);
    chk.checked = !!existing[i]?.aplicado;
    wrap.appendChild(lab);
  });
}
function amostraCard(a={},idx=0){
  const d=el("div","grid"); d.dataset.amostra=idx;
  d.innerHTML=`<label>Descrição <input class="a-descricao" value="${a.descricao||""}" required></label>
  <label>Tipo <input class="a-tipo" value="${a.tipo||""}"></label>
  <label>Dimensão nominal <input class="a-dimensao" value="${a.dimensao||""}"></label>
  <label>Cor <input class="a-cor" value="${a.cor||""}"></label>
  <label>Processo <input class="a-processo" value="${a.processo||""}"></label>
  <label>Marca <input class="a-marca" value="${a.marca||""}"></label>
  <label>Lote/Nº amostra <input class="a-lote" value="${a.lote||""}"></label>
  <label>Qtd. <input class="a-quantidade" value="${a.quantidade||""}" type="number" min="0"></label>
  <div><button type="button" class="secundario" data-remove>Remover</button></div>`;
  $("button[data-remove]",d).addEventListener("click",()=>d.remove());
  return d;
}
function resultadoRow(r={}){
  const tr=el("tr","");
  tr.innerHTML=`<td><input class="r-ensaio" value="${r.ensaio||""}" placeholder="Ensaio"></td>
  <td><input class="r-resultado" value="${r.resultado||""}" placeholder="Resultado"></td>
  <td><input class="r-requisito" value="${r.requisito||""}" placeholder="Requisito"></td>
  <td><select class="r-conf"><option ${r.conformidade==="Conforme"?"selected":""}>Conforme</option><option ${r.conformidade==="Não conforme"?"selected":""}>Não conforme</option></select></td>
  <td><button type="button" class="secundario del">Excluir</button></td>`;
  $(".del",tr).addEventListener("click",()=>tr.remove());
  return tr;
}
function addAmostra(){ $("#amostras").appendChild(amostraCard(novaAmostra())); }
function addResultado(){ $("#tblResultados tbody").appendChild(resultadoRow({})); }

/* ======= Imagens ======= */
function imagemCard(obj={src:"",alt:"",legenda:""}){
  const div=el("div","grid"); div.dataset.img="1";
  div.innerHTML=`
    <label>Imagem (URL ou selecione arquivo)
      <input class="img-url" type="url" value="${obj.src||""}" placeholder="https://..." />
      <input type="file" class="img-file" accept="image/*"/>
    </label>
    <label>Legenda <input class="img-cap" value="${obj.legenda||""}" placeholder="Ex.: Foto da amostra A"/></label>
    <label>Texto alternativo (acessibilidade) <input class="img-alt" value="${obj.alt||""}" placeholder="Descrição breve"/></label>
    <div><button type="button" class="secundario" data-remove>Remover imagem</button></div>`;
  $("button[data-remove]",div).addEventListener("click",()=>div.remove());
  $(".img-file",div).addEventListener("change", e=>{
    const file=e.target.files?.[0]; if(!file) return;
    const reader=new FileReader();
    reader.onload=()=>{ $(".img-url",div).value=reader.result; };
    reader.readAsDataURL(file);
  });
  return div;
}
function addImagem(){ $("#imagens").appendChild(imagemCard()); }

/* ======= Tabelas Extras ======= */
function tabelaCard(data={titulo:"",linhas:[["",""]]}){
  const div=el("div","extra-table"); div.dataset.tabela="1";
  let html=`
    <div class="grid">
      <label>Título da tabela
        <input class="tb-title" value="${data.titulo||""}" placeholder="Ex.: Medições dimensionais"/>
      </label>
    </div>
    <table class="tabela extra"><tbody>`;
  (data.linhas||[["",""]]).forEach(row=>{
    html+=`<tr><td contenteditable="true">${row[0]||""}</td><td contenteditable="true">${row[1]||""}</td></tr>`;
  });
  html+=`</tbody></table>
    <div style="display:flex;gap:8px;margin-top:8px;">
      <button type="button" class="secundario add-row">+ Linha</button>
      <button type="button" class="secundario" data-remove>Remover tabela</button>
    </div>`;
  div.innerHTML=html;
  $(".add-row",div).addEventListener("click",()=>{
    const tr=document.createElement("tr");
    tr.innerHTML=`<td contenteditable="true"></td><td contenteditable="true"></td>`;
    $("tbody",div).appendChild(tr);
  });
  $("button[data-remove]",div).addEventListener("click",()=>div.remove());
  return div;
}
function addTabela(){ $("#tabelasExtras").appendChild(tabelaCard({})); }

/* ======= Lista lateral ======= */
function desenharLista(){
  const termo=($("#filtroLista").value||"").toLowerCase();
  const ul=$("#listaRelatorios"); ul.innerHTML="";
  relatorios
    .filter(r=>[r.numeroRelatorio,r.responsavelTecnico,r.laboratorio].join(" ").toLowerCase().includes(termo))
    .sort((a,b)=>b.updatedAt-a.updatedAt)
    .forEach(r=>{
      const li=el("li","");
      li.innerHTML=`<strong>${r.numeroRelatorio||"(sem nº)"} – ${r.responsavelTecnico||"?"}</strong>
        <span class="meta">${new Date(r.updatedAt).toLocaleString()} • ${r.laboratorio||""}</span>
        <div class="row-actions"><button data-open>Abrir</button><button data-delete class="del">Apagar</button></div>`;
      $("button[data-open]",li).addEventListener("click",()=>{atual=r;preencherForm(atual);});
      $("button[data-delete]",li).addEventListener("click",()=>{if(confirm("Apagar?")){relatorios=relatorios.filter(x=>x.id!==r.id);persistAll();desenharLista();}});
      ul.appendChild(li);
    });
  if(!ul.children.length){ const li=el("li",""); li.textContent="Nenhum relatório salvo."; ul.appendChild(li); }
}

/* ======= Exportar / Importar ======= */
function exportarJSON(){
  const data=coletarForm();
  const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob);
  a.download=`relatorio-${sanitizeFileName(data.numeroRelatorio)||"ensaio"}.json`;
  a.click(); URL.revokeObjectURL(a.href);
}
function importarJSON(ev){
  const f=ev.target.files?.[0]; if(!f) return;
  const reader=new FileReader();
  reader.onload=()=>{ try{
    const data=JSON.parse(reader.result); atual={...novoRelatorio(),...data};
    montarNormasSelect(); preencherForm(atual); salvarAtual();
  }catch{ alert("Arquivo inválido."); } ev.target.value=""; };
  reader.readAsText(f);
}

/* ======= Util p/ PDF: carregar imagem (URL -> dataURL) ======= */
function loadImageAsDataURL(url){
  return new Promise((resolve, reject) => {
    if (/^data:image\//i.test(url)) return resolve(url); // já é base64
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try{
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/jpeg", 0.92));
      }catch(err){ reject(err); }
    };
    img.onerror = reject;
    img.src = url;
  });
}

/* ======= PDF (texto) com imagens/tabelas extras ======= */
async function gerarPDF(){
  const {jsPDF}=window.jspdf;
  const r=coletarForm();
  const doc=new jsPDF({unit:"pt",format:"a4"});

  const PAGE_W = doc.internal.pageSize.getWidth();
  const PAGE_H = doc.internal.pageSize.getHeight();
  const MARGIN_X = 40, MARGIN_TOP = 50, MARGIN_BOTTOM = 40;
  let y = MARGIN_TOP;

  const addHeader = () => {
    doc.setFontSize(16); doc.setTextColor(THEME.ink); doc.setFont("helvetica","bold");
    doc.text("Relatório de Ensaio – PVC-U", MARGIN_X, y); y += 10;
    doc.setDrawColor(190); doc.line(MARGIN_X, y, PAGE_W - MARGIN_X, y);
    y += 18; doc.setFont("helvetica","normal");
  };
  const addFooter = () => {
    const pageNum = doc.internal.getNumberOfPages();
    doc.setFontSize(9); doc.setTextColor(120);
    doc.text(`Relatório ${r.numeroRelatorio || "-"} • pág. ${pageNum}`, PAGE_W - MARGIN_X, PAGE_H - 20, { align: "right" });
  };
  const ensureSpace = (h=18) => {
    if (y + h > PAGE_H - MARGIN_BOTTOM) {
      addFooter(); doc.addPage(); y = MARGIN_TOP; addHeader();
    }
  };
  const title = (t) => {
    ensureSpace(24);
    doc.setFont("helvetica","bold"); doc.setFontSize(12); doc.setTextColor(THEME.brand);
    doc.text(t, MARGIN_X, y); y += 14;
    doc.setFont("helvetica","normal"); doc.setFontSize(11); doc.setTextColor(THEME.ink);
  };
  const paragraph = (txt, width=PAGE_W - 2*MARGIN_X, lineH=14) => {
    const lines = doc.splitTextToSize(txt || "-", width);
    lines.forEach(()=>ensureSpace(lineH));
    doc.text(lines, MARGIN_X, y);
    y += lines.length * lineH + 6;
  };
  const kv = (k,v) => paragraph(`${k}: ${v||"-"}`);

  addHeader();

  title("1. Identificação do Relatório");
  kv("Número", r.numeroRelatorio);
  kv("Revisão", r.revisao);
  kv("Data de emissão", r.dataEmissao);
  kv("Responsável Técnico", r.responsavelTecnico);
  kv("Laboratório", r.laboratorio);
  kv("Normas de referência", (r.normasReferencia||[]).join("; "));

  title("2. Identificação da(s) Amostra(s)");
  (r.amostras||[]).forEach((a,i)=>{
    paragraph(`Amostra ${i+1}: ${[
      a.descricao && `Descrição: ${a.descricao}`,
      a.tipo && `Tipo: ${a.tipo}`,
      a.dimensao && `Dimensão nominal: ${a.dimensao}`,
      a.cor && `Cor: ${a.cor}`,
      a.processo && `Processo: ${a.processo}`,
      a.marca && `Marca: ${a.marca}`,
      a.lote && `Lote/Nº: ${a.lote}`,
      a.quantidade && `Qtd.: ${a.quantidade}`
    ].filter(Boolean).join(" | ")}`);
  });

  title("3. Objetivo do Ensaio");
  paragraph(r.objetivo);

  title("4. Métodos e Materiais Empregados");
  const ativos = (r.metodos||[]).filter(m=>m.aplicado).map(m=>`${m.ensaio} — ${m.norma}`);
  paragraph(ativos.length ? ativos.join("\n") : "Nenhum método marcado.");

  title("5. Resultados dos Ensaios");
  const rows = r.resultados || [];
  if (!rows.length) paragraph("Sem resultados informados.");
  else rows.forEach(res => {
    ensureSpace(42);
    doc.setFont("helvetica","bold"); doc.text(`• ${res.ensaio || "-"}`, MARGIN_X, y); y += 14;
    doc.setFont("helvetica","normal");
    paragraph(`Resultado: ${res.resultado || "-"}`);
    paragraph(`Requisito normativo: ${res.requisito || "-"}`);
    doc.setTextColor(res.conformidade === "Conforme" ? THEME.success : THEME.danger);
    paragraph(`Conformidade: ${res.conformidade || "-"}`);
    doc.setTextColor(THEME.ink);
    y += 2;
  });

  title("6. Discussão dos Resultados");
  paragraph(r.discussao);

  title("7. Conclusão");
  paragraph(`Status: ${r.conclusao?.status || "-"}`);
  paragraph(r.conclusao?.observacoes || "");

  title("8. Anexos");
  const anex = r.anexos||{};
  paragraph(`Certificados: ${(anex.certificados||[]).join("; ") || "-"}`);
  paragraph(`Planilhas/Gráficos: ${(anex.planilhas||[]).join("; ") || "-"}`);
  paragraph(`Fotos das amostras: ${(anex.fotos||[]).join("; ") || "-"}`);

  if ((r.imagens||[]).length){
    title("9. Imagens");
    const thumbW = 220, thumbMaxH = 160, gap = 14;
    let col = 0;
    for (let i=0;i<r.imagens.length;i++){
      const it = r.imagens[i];
      const url = (typeof it === "string") ? it : it.src;
      const legenda = (typeof it === "object" ? it.legenda : "") || `Figura ${i+1}`;
      try{
        const dataUrl = await loadImageAsDataURL(url);
        const img = new Image(); img.src = dataUrl;
        await new Promise(res => { if (img.complete) res(); else img.onload = res; });
        const ratio = img.naturalHeight / img.naturalWidth;
        const h = Math.min(thumbW * ratio, thumbMaxH);
        const w = thumbW;
        ensureSpace(h + 18);
        const x = MARGIN_X + col * (w + gap);
        doc.addImage(dataUrl, "JPEG", x, y, w, h);
        doc.setFontSize(9); doc.setTextColor(100);
        doc.text(legenda, x, y + h + 10);
        doc.setTextColor(THEME.ink);
        if (col === 1){ y += h + 26; col = 0; } else { col = 1; }
      }catch{
        ensureSpace(14);
        doc.setFontSize(10); doc.setTextColor(150);
        doc.text(`(Não foi possível carregar a imagem ${i+1})`, MARGIN_X, y);
        y += 16; doc.setTextColor(THEME.ink);
      }
    }
    if (col === 1) y += 8;
  }

  if ((r.tabelasExtras||[]).length){
    title("10. Tabelas adicionais");
    const colW = (PAGE_W - 2*MARGIN_X - 20) / 2;
    const lineH = 14;
    (r.tabelasExtras||[]).forEach((tbl, idxTbl) => {
      ensureSpace(18);
      doc.setFont("helvetica","bold"); doc.setFontSize(11); doc.setTextColor(THEME.ink);
      const titulo = tbl?.titulo ? `Tabela ${idxTbl+1} — ${tbl.titulo}` : `Tabela ${idxTbl+1}`;
      doc.text(titulo, MARGIN_X, y); y += 12;
      doc.setFont("helvetica","normal"); doc.setFontSize(10);

      const linhas = tbl?.linhas || tbl || [];
      if (!linhas.length){ paragraph("(sem dados)"); return; }

      ensureSpace(lineH);
      doc.setFont("helvetica","bold");
      doc.text("Coluna 1", MARGIN_X, y);
      doc.text("Coluna 2", MARGIN_X + colW + 20, y);
      doc.setFont("helvetica","normal");
      y += 10;

      linhas.forEach((row) => {
        const c1 = (row?.[0] ?? "").toString();
        const c2 = (row?.[1] ?? "").toString();
        const c1Lines = doc.splitTextToSize(c1, colW);
        const c2Lines = doc.splitTextToSize(c2, colW);
        const h = Math.max(c1Lines.length, c2Lines.length) * lineH;

        ensureSpace(h + 4);
        c1Lines.forEach((ln, i) => doc.text(ln, MARGIN_X, y + i*lineH));
        c2Lines.forEach((ln, i) => doc.text(ln, MARGIN_X + colW + 20, y + i*lineH));
        y += h + 4;
      });

      y += 6;
    });
  }

  addFooter();
  doc.save(`relatorio-${sanitizeFileName(r.numeroRelatorio)||"ensaio"}.pdf`);
}

/* ======= PDF (layout HTML) ======= */
function gerarPDFhtml(){
  const relatorio=$("#formRelatorio");
  html2pdf().set({
    margin:0.5,
    filename:`relatorio-${sanitizeFileName($("#formRelatorio").numeroRelatorio.value)||"ensaio"}.pdf`,
    image:{type:'jpeg',quality:0.98},
    html2canvas:{scale:2, useCORS:true},
    jsPDF:{unit:'in',format:'a4',orientation:'portrait'}
  }).from(relatorio).save();
}
// Excluir normas selecionadas
document.getElementById("btnDelNorma").addEventListener("click", () => {
  const select = document.getElementById("normasSelect");
  const selecionados = Array.from(select.selectedOptions);

  if (selecionados.length === 0) {
    alert("Selecione pelo menos uma norma para excluir.");
    return;
  }

  selecionados.forEach(opt => opt.remove());
});
