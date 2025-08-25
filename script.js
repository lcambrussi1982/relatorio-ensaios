/* =========================
   PALETA (alinhada ao CSS)
   ========================= */
const THEME = {
  brand: "#0EA5A4",
  brandWeak: "#DFF7F6",
  ink: "#0B1220",
  muted: "#5F6B84",
  border: "#E7ECF3",
  success: "#22C55E",
  danger: "#E11D48",
  accent: "#F97316"
};

/* ======= Modelo de dados ======= */
const ENSAIOS_DEFAULT = [
  { ensaio: "Efeito sobre a água (Inocuidade)", norma: "ABNT NBR 8219" },
  { ensaio: "Temperatura de amolecimento Vicat", norma: "ABNT NBR NM 82" },
  { ensaio: "Presença de chumbo", norma: "EN 62321-3-1:2014" },
  { ensaio: "Teor de cinzas", norma: "ABNT NBR NM 84" },
  { ensaio: "Resistência à pressão hidrostática interna", norma: "ABNT NBR 8218" },
  { ensaio: "Características geométricas", norma: "ABNT NBR 14264" },
  { ensaio: "Desempenho da junta soldável", norma: "ABNT NBR 7371" },
];

const STORAGE_KEY = "relatorios-ensaio-v2"; // bump: v2 para novas estruturas

/* ======= Utilidades ======= */
const $ = (sel, ctx=document) => ctx.querySelector(sel);
const $$ = (sel, ctx=document) => Array.from(ctx.querySelectorAll(sel));
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())+Math.random());
const el = (tag, cls, html) => { const e=document.createElement(tag); if(cls) e.className=cls; if(html!=null) e.innerHTML=html; return e; }
const announce = (msg) => { const live=$("#ariaLive"); if(!live) return; live.textContent=""; setTimeout(()=> live.textContent=msg, 10); };
const sanitizeFileName = (s) => (s||"ensaio").replace(/[^\p{L}\p{N}\-_.]+/gu,"-").replace(/-+/g,"-").replace(/(^-|-$)/g,"");
const debounce = (fn, ms=600) => { let t; return (...args)=>{ clearTimeout(t); t=setTimeout(()=>fn(...args), ms); }; };

/* ======= Estado ======= */
let relatorios = loadAll();
let atual = novoRelatorio();

/* ======= Init ======= */
document.addEventListener("DOMContentLoaded", () => {
  $("#ano").textContent = new Date().getFullYear();

  montarMetodos();
  preencherForm(atual);
  desenharLista();

  // Seções
  $("#btnAddAmostra")?.addEventListener("click", () => { addAmostra(); announce("Amostra adicionada."); });
  $("#btnAddResultado")?.addEventListener("click", () => { addResultado(); announce("Linha de resultado adicionada."); });
  $("#btnAddImagem")?.addEventListener("click", () => { addImagem(); announce("Imagem adicionada."); });
  $("#btnAddTabela")?.addEventListener("click", () => { addTabela(); announce("Tabela adicional adicionada."); });

  // Ações principais
  $("#btnNovo").addEventListener("click", () => { atual = novoRelatorio(); preencherForm(atual); announce("Novo relatório iniciado."); });
  $("#btnSalvar").addEventListener("click", salvarAtual);
  $("#btnExportar").addEventListener("click", exportarJSON);
  $("#inputImportar").addEventListener("change", importarJSON);
  $("#btnImprimir").addEventListener("click", () => window.print());
  $("#filtroLista").addEventListener("input", desenharLista);
  $("#btnToggleAside")?.addEventListener("click", toggleAside);

  // Autosave (debounced) ao digitar
  $("#formRelatorio").addEventListener("input", debounce(()=>{ salvarAtualSilencioso(); }, 800));
  $("#formRelatorio").addEventListener("change", debounce(()=>{ salvarAtualSilencioso(); }, 300));

  // PDFs
  $("#btnPDF").addEventListener("click", () => gerarPDF());
  $("#btnPDFhtml").addEventListener("click", gerarPDFhtml);
});

/* ======= Modelo / CRUD ======= */
function novoRelatorio(){
  return {
    id: uid(),
    numeroRelatorio: "",
    revisao: "",
    dataEmissao: "",
    responsavelTecnico: "",
    laboratorio: "",
    normasReferencia: [],
    amostras: [novaAmostra()],
    objetivo: "",
    metodos: ENSAIOS_DEFAULT.map(m => ({...m, aplicado: false})),
    resultados: [],
    discussao: "",
    conclusao: { status: "Conforme", observacoes: "" },
    anexos: { certificados: [], planilhas: [], fotos: [] },

    // Imagens: array de objetos {src, alt, legenda}
    imagens: [],
    // Tabelas extras: array de {titulo, linhas: [[c1,c2], ...]}
    tabelasExtras: [],

    updatedAt: Date.now()
  };
}
function novaAmostra(){ return { descricao:"", tipo:"", dimensao:"", cor:"", processo:"", marca:"", lote:"", quantidade:"" }; }
function loadAll(){ try{ return JSON.parse(localStorage.getItem(STORAGE_KEY))||[] }catch{ return [] } }
function persistAll(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(relatorios)); }
function salvarAtual(){
  if(!$("#formRelatorio").reportValidity()) { announce("Formulário inválido, verifique os campos obrigatórios."); return; }
  const data = coletarForm(); data.updatedAt = Date.now();
  const ix = relatorios.findIndex(r => r.id === data.id);
  if(ix >= 0) relatorios[ix] = data; else relatorios.unshift(data);
  persistAll(); desenharLista(); announce("Relatório salvo.");
}
function salvarAtualSilencioso(){
  if(!$("#formRelatorio")) return;
  const data = coletarForm(); data.updatedAt = Date.now();
  const ix = relatorios.findIndex(r => r.id === data.id);
  if(ix >= 0) relatorios[ix] = data; else relatorios.unshift(data);
  persistAll(); // sem alert
}

/* ======= Mostrar/Ocultar lateral (mobile) ======= */
function toggleAside(){
  document.body.classList.toggle("aside-collapsed");
  const state = document.body.classList.contains("aside-collapsed") ? "oculta" : "visível";
  announce(`Lista lateral ${state}.`);
}

/* ======= Form <-> Estado ======= */
function preencherForm(r){
  const f = $("#formRelatorio");
  f.numeroRelatorio.value = r.numeroRelatorio||"";
  f.revisao.value = r.revisao||"";
  f.dataEmissao.value = r.dataEmissao||"";
  f.responsavelTecnico.value = r.responsavelTecnico||"";
  f.laboratorio.value = r.laboratorio||"";
  f.normasReferencia.value = (r.normasReferencia||[]).join("; ");
  f.objetivo.value = r.objetivo||"";
  f.discussao.value = r.discussao||"";
  f.statusConclusao.value = r.conclusao?.status||"Conforme";
  f.conclusaoObs.value = r.conclusao?.observacoes||"";
  f.anexosCertificados.value = (r.anexos?.certificados||[]).join("; ");
  f.anexosPlanilhas.value = (r.anexos?.planilhas||[]).join("; ");
  f.anexosFotos.value = (r.anexos?.fotos||[]).join("; ");
  f.id.value = r.id;

  // Amostras
  $("#amostras").innerHTML = "";
  (r.amostras||[]).forEach((a,i)=>$("#amostras").appendChild(amostraCard(a,i)));

  // Métodos
  montarMetodos(); // garante estrutura
  $$("#metodos input[type='checkbox']").forEach((chk,i)=>{ chk.checked = !!r.metodos[i]?.aplicado; });

  // Resultados
  $("#tblResultados tbody").innerHTML = "";
  (r.resultados||[]).forEach((row,i)=>$("#tblResultados tbody").appendChild(resultadoRow(row,i)));

  // Imagens
  $("#imagens").innerHTML = "";
  (r.imagens||[]).forEach(obj => $("#imagens").appendChild(imagemCard(obj)));

  // Tabelas extras
  $("#tabelasExtras").innerHTML = "";
  (r.tabelasExtras||[]).forEach(tbl => $("#tabelasExtras").appendChild(tabelaCard(tbl)));
}

function coletarForm(){
  const f=$("#formRelatorio");
  return {
    id: f.id.value||uid(),
    numeroRelatorio: f.numeroRelatorio.value.trim(),
    revisao: f.revisao.value.trim(),
    dataEmissao: f.dataEmissao.value,
    responsavelTecnico: f.responsavelTecnico.value.trim(),
    laboratorio: f.laboratorio.value.trim(),
    normasReferencia: splitList(f.normasReferencia.value),

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
    metodos:$$("#metodos .metodo").map((m,i)=>({ ...ENSAIOS_DEFAULT[i], aplicado:$("input",m).checked })),
    resultados:$$("tbody tr",$("#tblResultados")).map(tr=>({
      ensaio:$(".r-ensaio",tr).value.trim(),
      resultado:$(".r-resultado",tr).value.trim(),
      requisito:$(".r-requisito",tr).value.trim(),
      conformidade:$(".r-conf",tr).value
    })),
    discussao:f.discussao.value.trim(),
    conclusao:{ status:f.statusConclusao.value, observacoes:f.conclusaoObs.value.trim() },
    anexos:{ certificados:splitList(f.anexosCertificados.value), planilhas:splitList(f.anexosPlanilhas.value), fotos:splitList(f.anexosFotos.value) },

    // Imagens
    imagens: $$("[data-img]").map(w => ({
      src: $(".img-url", w).value.trim(),
      alt: $(".img-alt", w).value.trim(),
      legenda: $(".img-cap", w).value.trim()
    })).filter(i=>i.src),

    // Tabelas extras
    tabelasExtras: $$("[data-tabela]").map(box => ({
      titulo: $(".tb-title", box).value.trim(),
      linhas: $$("tbody tr", box).map(tr => [
        (tr.cells[0]?.innerText||"").trim(),
        (tr.cells[1]?.innerText||"").trim()
      ])
    })),

    updatedAt:Date.now()
  };
}
const splitList = s => (s||"").split(";").map(x=>x.trim()).filter(Boolean);

/* ======= UI ======= */
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
  $("button[data-remove]",d).addEventListener("click",()=>{ d.remove(); announce("Amostra removida."); });
  return d;
}
function montarMetodos(){
  const w=$("#metodos"); w.innerHTML="";
  ENSAIOS_DEFAULT.forEach(m=>{
    const lab=el("label","metodo");
    lab.innerHTML=`<input type="checkbox"/><span><strong>${m.ensaio}</strong> — <em>${m.norma}</em></span>`;
    w.appendChild(lab);
  });
}
function resultadoRow(r={},i=0){
  const tr=el("tr","");
  tr.innerHTML=`<td><input class="r-ensaio" value="${r.ensaio||""}"></td>
  <td><input class="r-resultado" value="${r.resultado||""}"></td>
  <td><input class="r-requisito" value="${r.requisito||""}"></td>
  <td><select class="r-conf"><option ${r.conformidade==="Conforme"?"selected":""}>Conforme</option>
  <option ${r.conformidade==="Não conforme"?"selected":""}>Não conforme</option></select></td>
  <td><button type="button" class="del">Excluir</button></td>`;
  $(".del",tr).addEventListener("click",()=>{ tr.remove(); announce("Linha de resultado removida."); });
  return tr;
}
function addAmostra(){ const card=amostraCard(novaAmostra()); $("#amostras").appendChild(card); card.querySelector("input")?.focus(); }
function addResultado(){ const row=resultadoRow({}); $("#tblResultados tbody").appendChild(row); $(".r-ensaio",row)?.focus(); }

/* ======= Imagens ======= */
function imagemCard(obj={src:"", alt:"", legenda:""}){
  const div = el("div","grid"); div.dataset.img = "1";
  div.innerHTML = `
    <label>Imagem (URL ou selecione arquivo)
      <input class="img-url" type="url" value="${obj.src||""}" placeholder="https://..." />
      <input type="file" class="img-file" accept="image/*"/>
    </label>
    <label>Legenda
      <input class="img-cap" value="${obj.legenda||""}" placeholder="Ex.: Foto da amostra A"/>
    </label>
    <label>Texto alternativo (acessibilidade)
      <input class="img-alt" value="${obj.alt||""}" placeholder="Descrição breve da imagem"/>
    </label>
    <div><button type="button" class="secundario" data-remove>Remover imagem</button></div>
  `;
  $("button[data-remove]", div).addEventListener("click", ()=>{ div.remove(); announce("Imagem removida."); });
  $(".img-file", div).addEventListener("change", async e=>{
    const file = e.target.files?.[0]; if(!file) return;
    const dataUrl = await fileToDataURLCompressed(file, 1200, 0.85);
    $(".img-url",div).value = dataUrl;
    announce("Imagem carregada.");
  });
  return div;
}
function addImagem(){ const w=imagemCard(); $("#imagens").appendChild(w); $(".img-url",w)?.focus(); }
function fileToDataURLCompressed(file, maxW=1200, quality=0.85){
  return new Promise((resolve, reject)=>{
    const reader=new FileReader();
    reader.onload=()=>{
      const img=new Image();
      img.onload=()=>{
        const scale = Math.min(1, maxW / img.width);
        const canvas=document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx=canvas.getContext("2d");
        ctx.drawImage(img,0,0,canvas.width,canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror=reject;
      img.src=reader.result;
    };
    reader.onerror=reject;
    reader.readAsDataURL(file);
  });
}

/* ======= Tabelas Extras ======= */
function tabelaCard(data={titulo:"", linhas:[["",""]]}){
  const div = el("div","extra-table"); div.dataset.tabela = "1";
  let html = `
    <div class="grid">
      <label>Título da tabela
        <input class="tb-title" value="${data.titulo||""}" placeholder="Ex.: Medições dimensionais"/>
      </label>
    </div>
    <table class="tabela extra"><tbody>`;
  (data.linhas||[["",""]]).forEach(row=>{
    html += `<tr><td contenteditable="true">${row[0]||""}</td><td contenteditable="true">${row[1]||""}</td></tr>`;
  });
  html += `</tbody></table>
           <div style="display:flex;gap:8px;margin-top:8px;">
             <button type="button" class="secundario add-row">+ Linha</button>
             <button type="button" class="secundario" data-remove>Remover tabela</button>
           </div>`;
  div.innerHTML = html;

  $(".add-row", div).addEventListener("click", ()=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `<td contenteditable="true"></td><td contenteditable="true"></td>`;
    $("tbody", div).appendChild(tr);
  });
  $("button[data-remove]", div).addEventListener("click", ()=>{ div.remove(); announce("Tabela removida."); });
  return div;
}
function addTabela(){ const t=tabelaCard({titulo:"",linhas:[["",""]]}); $("#tabelasExtras").appendChild(t); $(".tb-title",t)?.focus(); }

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
      $("button[data-open]",li).addEventListener("click",()=>{atual=r;preencherForm(atual); announce("Relatório carregado.");});
      $("button[data-delete]",li).addEventListener("click",()=>{if(confirm("Apagar?")){relatorios=relatorios.filter(x=>x.id!==r.id);persistAll();desenharLista();announce("Relatório apagado.");}});
      ul.appendChild(li);
    });
  if(!ul.children.length){
    const li=el("li",""); li.textContent="Nenhum relatório salvo."; ul.appendChild(li);
  }
}

/* ======= Exportar / Importar ======= */
function exportarJSON(){
  const data = coletarForm();
  const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob);
  a.download=`relatorio-${sanitizeFileName(data.numeroRelatorio)||"ensaio"}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}
function importarJSON(ev){
  const f=ev.target.files?.[0]; if(!f) return;
  const reader=new FileReader();
  reader.onload=()=>{
    try{
      const data=JSON.parse(reader.result);
      atual={...novoRelatorio(),...data}; // defaults + dados importados
      preencherForm(atual);
      salvarAtualSilencioso();
      announce("Relatório importado.");
    }catch(e){ alert("Arquivo inválido."); }
    ev.target.value="";
  };
  reader.readAsText(f);
}

/* ======= Helpers PDF ======= */
function loadImageAsDataURL(url){
  return new Promise((resolve, reject) => {
    if (/^data:image\//i.test(url)) return resolve(url);
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

/* ======= PDF (texto) ======= */
async function gerarPDF(){
  const {jsPDF}=window.jspdf;
  const doc=new jsPDF({unit:"pt",format:"a4"});
  const r=coletarForm();

  const PAGE_W = doc.internal.pageSize.getWidth();
  const PAGE_H = doc.internal.pageSize.getHeight();
  const MARGIN_X = 40;
  const MARGIN_TOP = 50;
  const MARGIN_BOTTOM = 40;
  let y = MARGIN_TOP;

  const addHeader = () => {
    doc.setFontSize(16); doc.setTextColor(THEME.ink); doc.setFont("helvetica","bold");
    doc.text("Relatório de Ensaio – PVC-U", MARGIN_X, y); y += 10;
    doc.setDrawColor(180); doc.line(MARGIN_X, y, PAGE_W - MARGIN_X, y);
    y += 18; doc.setFont("helvetica","normal");
  };
  const addFooter = (pageNum) => {
    doc.setFontSize(9); doc.setTextColor(120);
    doc.text(`Relatório ${r.numeroRelatorio || "-"} • pág. ${pageNum}`, PAGE_W - MARGIN_X, PAGE_H - 20, { align: "right" });
  };
  const ensureSpace = (h=18) => {
    if (y + h > PAGE_H - MARGIN_BOTTOM) {
      const pageNum = doc.internal.getNumberOfPages();
      addFooter(pageNum);
      doc.addPage();
      y = MARGIN_TOP;
      addHeader();
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

  // 1. Identificação
  title("1. Identificação do Relatório");
  kv("Número", r.numeroRelatorio);
  kv("Revisão", r.revisao);
  kv("Data de emissão", r.dataEmissao);
  kv("Responsável Técnico", r.responsavelTecnico);
  kv("Laboratório", r.laboratorio);
  kv("Normas de referência", (r.normasReferencia||[]).join("; "));

  // 2. Amostras
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

  // 3. Objetivo
  title("3. Objetivo do Ensaio");
  paragraph(r.objetivo);

  // 4. Métodos e Materiais
  title("4. Métodos e Materiais Empregados");
  const ativos = (r.metodos||[]).filter(m=>m.aplicado).map(m=>`${m.ensaio} — ${m.norma}`);
  paragraph(ativos.length ? ativos.join("\n") : "Nenhum método marcado.");

  // 5. Resultados
  title("5. Resultados dos Ensaios");
  const rows = r.resultados || [];
  if (!rows.length) {
    paragraph("Sem resultados informados.");
  } else {
    rows.forEach(res => {
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
  }

  // 6. Discussão
  title("6. Discussão dos Resultados");
  paragraph(r.discussao);

  // 7. Conclusão
  title("7. Conclusão");
  paragraph(`Status: ${r.conclusao?.status || "-"}`);
  paragraph(r.conclusao?.observacoes || "");

  // 8. Anexos
  title("8. Anexos");
  const anex = r.anexos||{};
  paragraph(`Certificados: ${(anex.certificados||[]).join("; ") || "-"}`);
  paragraph(`Planilhas/Gráficos: ${(anex.planilhas||[]).join("; ") || "-"}`);
  paragraph(`Fotos das amostras: ${(anex.fotos||[]).join("; ") || "-"}`);

  // 9. Imagens (2 colunas) com legenda e alt
  if ((r.imagens||[]).length){
    title("9. Imagens");
    const thumbW = 220, thumbMaxH = 160, gap = 14;
    let col = 0;
    for (let i=0;i<r.imagens.length;i++){
      const {src, alt, legenda} = r.imagens[i];
      try{
        const dataUrl = await loadImageAsDataURL(src);
        const img = new Image(); img.src = dataUrl;
        await new Promise(res => { if (img.complete) res(); else img.onload = res; });
        const ratio = img.naturalHeight / img.naturalWidth;
        const h = Math.min(thumbW * ratio, thumbMaxH);
        const w = thumbW;
        ensureSpace(h + 24);
        const x = MARGIN_X + col * (w + gap);
        doc.addImage(dataUrl, "JPEG", x, y, w, h);
        doc.setFontSize(9); doc.setTextColor(100);
        const cap = (legenda ? `Figura ${i+1}: ${legenda}` : `Figura ${i+1}`) + (alt ? ` — ${alt}` : "");
        doc.text(doc.splitTextToSize(cap, w), x, y + h + 12);
        doc.setTextColor(THEME.ink);
        if (col === 1){ y += h + 30; col = 0; } else { col = 1; }
      }catch{
        ensureSpace(14);
        doc.setFontSize(10); doc.setTextColor(150);
        doc.text(`(Não foi possível carregar a imagem ${i+1})`, MARGIN_X, y);
        y += 16; doc.setTextColor(THEME.ink);
      }
    }
    if (col === 1) y += 8;
  }

  // 10. Tabelas adicionais (2 colunas, com título)
  if ((r.tabelasExtras||[]).length){
    title("10. Tabelas adicionais");
    const colW = (PAGE_W - 2*MARGIN_X - 20) / 2;
    const lineH = 14;

    (r.tabelasExtras||[]).forEach((tbl, idxTbl) => {
      ensureSpace(22);
      const head = tbl.titulo ? `Tabela ${idxTbl+1} — ${tbl.titulo}` : `Tabela ${idxTbl+1}`;
      doc.setFont("helvetica","bold"); doc.setFontSize(11); doc.setTextColor(THEME.ink);
      doc.text(head, MARGIN_X, y); y += 12;
      doc.setFont("helvetica","normal"); doc.setFontSize(10);

      const linhas = tbl.linhas || [];
      if (!linhas.length){ paragraph("(sem dados)"); return; }

      ensureSpace(lineH);
      doc.setFont("helvetica","bold");
      doc.setTextColor(THEME.brand);
      doc.text("Coluna 1", MARGIN_X, y);
      doc.text("Coluna 2", MARGIN_X + colW + 20, y);
      doc.setTextColor(THEME.ink);
      doc.setFont("helvetica","normal");
      y += 10;

      linhas.forEach(row => {
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

  addFooter(doc.internal.getNumberOfPages());
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
