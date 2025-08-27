/* =========================
   Paleta p/ PDF e UI
   ========================= */
const THEME = {
  brand: "#E1262D",   // vermelho Shiva
  brandWeak: "#E6F7FF",
  ink: "#0F1E3D",
  muted: "#5C6B84",
  border: "#E2E8F0",
  sea: "#0077B6",     // azul da onda
  success: "#22C55E",
  danger: "#E11D48",
};

/* ======= Normas (combo) – opções iniciais ======= */
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

const STORAGE_KEY = "relatorios-ensaio-v4";

/* =========================
   Helpers DOM / Utils
   ========================= */
const $  = (sel, ctx=document) => ctx.querySelector(sel);
const $$ = (sel, ctx=document) => Array.from(ctx.querySelectorAll(sel));
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : (Date.now()+Math.random()).toString(36));
const el  = (t, attrs={}, html) => {
  const e = document.createElement(t);
  Object.entries(attrs||{}).forEach(([k,v]) => (k in e) ? (e[k]=v) : e.setAttribute(k,v));
  if (html != null) e.innerHTML = html;
  return e;
};
const splitList = s => (s||"").split(";").map(x=>x.trim()).filter(Boolean);
const sanitizeFileName = s => (s||"ensaio").replace(/[^\p{L}\p{N}\-_.]+/gu,"-").replace(/-+/g,"-").replace(/(^-|-$)/g,"");

/* =========================
   Microanimações (WAAPI)
   ========================= */
const Anim = {
  fadeIn(elm, dur=180, y=6){ elm.animate([
      {opacity:0, transform:`translateY(${y}px)`},
      {opacity:1, transform:"translateY(0)"}
    ], {duration:dur, easing:"ease-out"}); },
  fadeOut(elm, dur=150, y=6){ return elm.animate([
      {opacity:1, transform:"translateY(0)"},
      {opacity:0, transform:`translateY(${y}px)`}
    ], {duration:dur, easing:"ease-in", fill:"forwards"}).finished; },
  flash(elm){ elm.animate([
      {transform:"scale(1)", boxShadow:"none"},
      {transform:"scale(1.01)"},
      {transform:"scale(1)", boxShadow:"none"}
    ],{duration:260, easing:"ease-out"}); },
  pulse(elm){ elm.animate([
      {transform:"scale(1)"},
      {transform:"scale(1.03)"},
      {transform:"scale(1)"}
    ],{duration:280, easing:"ease-out"}); },
};

/* =========================
   Toast acessível (aria-live)
   ========================= */
function toast(msg, type="info"){
  const live = $("#ariaLive");
  if(!live) return alert(msg);
  const pill = el("div", {className:"toast", role:"status"});
  pill.style.cssText = `
    position:fixed; right:16px; bottom:16px; z-index:99999;
    background:${type==="error"?THEME.danger:(type==="success"?THEME.success:THEME.sea)};
    color:#fff; padding:10px 12px; border-radius:12px; box-shadow:0 8px 20px rgba(0,0,0,.12);
    font: 600 13px/1.2 system-ui,-apple-system,Segoe UI,Roboto,Ubuntu;`;
  pill.textContent = msg;
  document.body.appendChild(pill);
  Anim.fadeIn(pill,180,4);
  setTimeout(()=> Anim.fadeOut(pill,180,4).then(()=>pill.remove()), 2200);
  live.textContent = msg; // leitura por leitores de tela
}

/* =========================
   Estado geral
   ========================= */
let relatorios = loadAll();
let atual = novoRelatorio();

/* =========================
   Init
   ========================= */
document.addEventListener("DOMContentLoaded", async () => {
  const anoEl = $("#ano"); if (anoEl) anoEl.textContent = new Date().getFullYear();

  // --- AUTH: prepara e aplica estado de sessão ---
  await ensureDefaultAdmin();
  bindAuthEvents();

  const sess = getSession();
  if (sess) { lockUI(false); renderWhoAmI(); } else { lockUI(true); }
  applyRolePermissions(); // aplica bloqueios iniciais

  // --- APP UI ---
  montarNormasSelect();
  preencherForm(atual);
  desenharLista();

  // layout
  $("#btnToggleAside")?.addEventListener("click", ()=>{
    document.body.classList.toggle("aside-collapsed");
    toast(document.body.classList.contains("aside-collapsed")?"Lista oculta":"Lista visível");
  });

  // normas
  $("#btnAddNorma")?.addEventListener("click", () => withEditPerm(addNormaCustom));
  $("#btnDelNorma")?.addEventListener("click", () => withEditPerm(delNormasSelecionadas));

  // itens dinâmicos
  $("#btnAddAmostra")?.addEventListener("click", () => withEditPerm(addAmostra));
  $("#btnAddResultado")?.addEventListener("click", () => withEditPerm(addResultado));
  $("#btnAddImagem")?.addEventListener("click", () => withEditPerm(addImagem));
  $("#btnAddTabela")?.addEventListener("click", () => withEditPerm(addTabela));

  // ações principais
  $("#btnNovo")?.addEventListener("click", ()=> withEditPerm(()=>{
    atual = novoRelatorio();
    preencherForm(atual);
    toast("Relatório novo criado", "success");
  }));
  $("#btnSalvar")?.addEventListener("click", ()=> withEditPerm(salvarAtual));

  $("#btnExportar")?.addEventListener("click", exportarJSON);
  $("#inputImportar")?.addEventListener("change", (e)=> withEditPerm(()=>importarJSON(e)));
  $("#btnImprimir")?.addEventListener("click", ()=>window.print());

  // PDFs
  $("#btnPDF")?.addEventListener("click", gerarPDF);
  $("#btnPDFhtml")?.addEventListener("click", gerarPDFhtml);

  // filtro da lista
  $("#filtroLista")?.addEventListener("input", desenharLista);

  // Métodos: CRUD em GRID (fieldset 4)
  initMetodosGrid();
});

/* guard para ações de edição */
function withEditPerm(fn){
  if(!hasRole("admin","editor")){ toast("Sem permissão para editar (viewer).","error"); return; }
  fn?.();
}

/* =========================
   Modelo
   ========================= */
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
    // GRID de Métodos (fieldset 4):
    // {id, metodo, norma, equip, materiais, proced, criterio, unidade, aplicado}
    metodos: [],
    resultados: [],
    discussao: "",
    conclusao: { status:"Conforme", observacoes:"" },
    anexos: { certificados:[], planilhas:[], fotos:[] },
    imagens: [],                       // [{src, alt, legenda}]
    tabelasExtras: [],                 // [{titulo, linhas:[[c1,c2],...]}]
    updatedAt: Date.now(),
  };
}
function novaAmostra(){
  return { descricao:"", tipo:"", dimensao:"", cor:"", processo:"", marca:"", lote:"", quantidade:"" };
}
function loadAll(){
  try{ return JSON.parse(localStorage.getItem(STORAGE_KEY))||[] }catch{ return [] }
}
function persistAll(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(relatorios));
}
function salvarAtual(){
  const form = $("#formRelatorio");
  if(form && !form.reportValidity()) return;
  const data = coletarForm();
  data.updatedAt = Date.now();
  const ix = relatorios.findIndex(r=>r.id===data.id);
  if(ix>=0) relatorios[ix]=data; else relatorios.unshift(data);
  persistAll();
  desenharLista();
  toast("Relatório salvo!", "success");
}

/* =========================
   Normas: combo
   ========================= */
function montarNormasSelect(){
  const sel = $("#normasSelect");
  if(!sel) return;
  sel.innerHTML = "";
  NORMAS_OPCOES.forEach(n=>{
    const opt = el("option",{value:n},n);
    sel.appendChild(opt);
  });
}
function setNormasSelecionadas(valores=[]){
  const sel = $("#normasSelect"); if(!sel) return;
  const set = new Set(valores);
  $$("option", sel).forEach(o => o.selected = set.has(o.value));
}
function getNormasSelecionadas(){
  const sel = $("#normasSelect"); if(!sel) return [];
  return Array.from(sel.selectedOptions).map(o=>o.value);
}
function addNormaCustom(){
  const inp = $("#novaNorma");
  if(!inp) return;
  const valor = (inp.value||"").trim();
  if(!valor) return;
  const sel = $("#normasSelect"); if(!sel) return;
  let opt = Array.from(sel.options).find(o=>o.value.toLowerCase()===valor.toLowerCase());
  if(!opt){
    opt = el("option",{value:valor},valor);
    sel.appendChild(opt);
    Anim.flash(sel);
  }
  opt.selected = true;
  inp.value = "";
  toast("Norma adicionada/selecionada", "success");
}
function delNormasSelecionadas(){
  const sel = $("#normasSelect"); if(!sel) return;
  const selecionados = Array.from(sel.selectedOptions);
  if(!selecionados.length){ toast("Selecione pelo menos uma norma para excluir.","error"); return; }

  const nomes = selecionados.map(o=>o.text).join("\n- ");
  const ok = confirm(`Você tem certeza que deseja excluir as seguintes norma(s)?\n\n- ${nomes}`);
  if(!ok) return;

  (async ()=>{
    for(const opt of selecionados){
      await Anim.fadeOut(opt,120,2);
      opt.remove();
    }
    toast("Normas removidas");
  })();
}

/* =========================
   Form <-> Estado
   ========================= */
function preencherForm(r){
  const f=$("#formRelatorio"); if(!f) return;
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
  const amDiv = $("#amostras");
  if(amDiv){
    amDiv.innerHTML="";
    (r.amostras||[]).forEach((a,i)=>{
      const card = amostraCard(a,i);
      amDiv.appendChild(card);
      Anim.fadeIn(card,140,6);
    });
  }

  // MÉTODOS (GRID)
  MetGrid.state = Array.isArray(r.metodos) ? structuredClone(r.metodos) : [];
  MetGrid.render();

  // Resultados
  const tbodyRes = $("#tblResultados tbody");
  if(tbodyRes){
    tbodyRes.innerHTML="";
    (r.resultados||[]).forEach(row=>{
      const tr = resultadoRow(row);
      tbodyRes.appendChild(tr);
      Anim.fadeIn(tr,120,4);
    });
  }

  // Imagens
  const imgs = $("#imagens");
  if(imgs){
    imgs.innerHTML="";
    (r.imagens||[]).forEach(img=>{
      const card = imagemCard(img);
      imgs.appendChild(card);
      Anim.fadeIn(card,120,4);
    });
  }

  // Tabelas extras
  const extras = $("#tabelasExtras");
  if(extras){
    extras.innerHTML="";
    (r.tabelasExtras||[]).forEach(tbl=>{
      const t = tabelaCard(tbl);
      extras.appendChild(t);
      Anim.fadeIn(t,120,4);
    });
  }

  // Reaplica bloqueio se viewer
  applyRolePermissions();
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

    // Métodos do GRID (estado em memória)
    metodos: structuredClone(MetGrid.state),

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

/* =========================
   Amostras
   ========================= */
function amostraCard(a={},idx=0){
  const d=el("div",{className:"grid"}); d.dataset.amostra=idx;
  d.innerHTML=`<label>Descrição <input class="a-descricao" value="${a.descricao||""}" required></label>
  <label>Tipo <input class="a-tipo" value="${a.tipo||""}"></label>
  <label>Dimensão nominal <input class="a-dimensao" value="${a.dimensao||""}"></label>
  <label>Cor <input class="a-cor" value="${a.cor||""}"></label>
  <label>Processo <input class="a-processo" value="${a.processo||""}"></label>
  <label>Marca <input class="a-marca" value="${a.marca||""}"></label>
  <label>Lote/Nº amostra <input class="a-lote" value="${a.lote||""}"></label>
  <label>Qtd. <input class="a-quantidade" value="${a.quantidade||""}" type="number" min="0"></label>
  <div><button type="button" class="secundario" data-remove>Remover</button></div>`;
  $("button[data-remove]",d).addEventListener("click", async ()=>{
    await Anim.fadeOut(d,150,6); d.remove(); toast("Amostra removida");
  });
  return d;
}
function addAmostra(){
  const card = amostraCard(novaAmostra());
  $("#amostras").appendChild(card);
  Anim.fadeIn(card,160,8);
}

/* =========================
   Resultados
   ========================= */
function resultadoRow(r={}){
  const tr=el("tr");
  tr.innerHTML=`<td><input class="r-ensaio" value="${r.ensaio||""}" placeholder="Ensaio"></td>
  <td><input class="r-resultado" value="${r.resultado||""}" placeholder="Resultado"></td>
  <td><input class="r-requisito" value="${r.requisito||""}" placeholder="Requisito"></td>
  <td><select class="r-conf"><option ${r.conformidade==="Conforme"?"selected":""}>Conforme</option><option ${r.conformidade==="Não conforme"?"selected":""}>Não conforme</option></select></td>
  <td><button type="button" class="secundario del">Excluir</button></td>`;
  $(".del",tr).addEventListener("click", async ()=>{
    const ok = confirm("Excluir esta linha de resultado?");
    if(!ok) return;
    await Anim.fadeOut(tr,130,4); tr.remove();
  });
  return tr;
}
function addResultado(){
  const tr = resultadoRow({});
  $("#tblResultados tbody").appendChild(tr);
  Anim.fadeIn(tr,140,6);
}

/* =========================
   Imagens
   ========================= */
function imagemCard(obj={src:"",alt:"",legenda:""}){
  const div=el("div",{className:"grid"}); div.dataset.img="1";
  div.innerHTML=`
    <label>Imagem (URL ou selecione arquivo)
      <input class="img-url" type="url" value="${obj.src||""}" placeholder="https://..." />
      <input type="file" class="img-file" accept="image/*"/>
    </label>
    <label>Legenda <input class="img-cap" value="${obj.legenda||""}" placeholder="Ex.: Foto da amostra A"/></label>
    <label>Texto alternativo (acessibilidade) <input class="img-alt" value="${obj.alt||""}" placeholder="Descrição breve"/></label>
    <div><button type="button" class="secundario" data-remove>Remover imagem</button></div>`;
  $("button[data-remove]",div).addEventListener("click", async ()=>{
    const ok = confirm("Remover esta imagem?");
    if(!ok) return;
    await Anim.fadeOut(div,130,4); div.remove();
  });
  $(".img-file",div).addEventListener("change", e=>{
    const file=e.target.files?.[0]; if(!file) return;
    const reader=new FileReader();
    reader.onload=()=>{ $(".img-url",div).value=reader.result; Anim.pulse($(".img-url",div)); toast("Imagem carregada","success"); };
    reader.readAsDataURL(file);
  });
  return div;
}
function addImagem(){
  const card = imagemCard();
  $("#imagens").appendChild(card);
  Anim.fadeIn(card,140,6);
}

/* =========================
   Tabelas Extras
   ========================= */
function tabelaCard(data={titulo:"",linhas:[["",""]]}){
  const div=el("div",{className:"extra-table"}); div.dataset.tabela="1";
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
    Anim.fadeIn(tr,120,4);
  });
  $("button[data-remove]",div).addEventListener("click", async ()=>{
    const ok = confirm("Remover esta tabela?");
    if(!ok) return;
    await Anim.fadeOut(div,130,4); div.remove();
  });
  return div;
}
function addTabela(){
  const t = tabelaCard({});
  $("#tabelasExtras").appendChild(t);
  Anim.fadeIn(t,140,6);
}

/* =========================
   Lista lateral (salvos)
   ========================= */
function desenharLista(){
  const termo=($("#filtroLista")?.value||"").toLowerCase();
  const ul=$("#listaRelatorios"); if(!ul) return;
  ul.innerHTML="";
  relatorios
    .filter(r=>[r.numeroRelatorio,r.responsavelTecnico,r.laboratorio].join(" ").toLowerCase().includes(termo))
    .sort((a,b)=>b.updatedAt-a.updatedAt)
    .forEach(r=>{
      const li=el("li");
      li.innerHTML=`<strong>${r.numeroRelatorio||"(sem nº)"} – ${r.responsavelTecnico||"?"}</strong>
        <span class="meta">${new Date(r.updatedAt).toLocaleString()} • ${r.laboratorio||""}</span>
        <div class="row-actions">
          <button data-open class="secundario">Abrir</button>
          <button data-delete class="danger">Apagar</button>
        </div>`;
      $("button[data-open]",li).addEventListener("click",()=>{
        atual=r; preencherForm(atual); toast("Relatório carregado");
      });
      $("button[data-delete]",li).addEventListener("click", async ()=>{
        if(!hasRole("admin","editor")){ toast("Sem permissão para excluir.","error"); return; }
        if(!confirm("Apagar este relatório?")) return;
        await Anim.fadeOut(li,130,4);
        relatorios=relatorios.filter(x=>x.id!==r.id);
        persistAll(); desenharLista(); toast("Relatório apagado");
      });
      ul.appendChild(li);
      Anim.fadeIn(li,120,4);
    });
  if(!ul.children.length){ const li=el("li"); li.textContent="Nenhum relatório salvo."; ul.appendChild(li); }
}

/* =========================
   Exportar / Importar
   ========================= */
function exportarJSON(){
  const data=coletarForm();
  const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob);
  a.download=`relatorio-${sanitizeFileName(data.numeroRelatorio)||"ensaio"}.json`;
  a.click(); URL.revokeObjectURL(a.href);
  toast("JSON exportado","success");
}
function importarJSON(ev){
  const f=ev.target.files?.[0]; if(!f) return;
  const reader=new FileReader();
  reader.onload=()=>{ try{
    const data=JSON.parse(reader.result);
    atual={...novoRelatorio(),...data};
    montarNormasSelect(); preencherForm(atual); salvarAtual();
    toast("JSON importado","success");
  }catch{ toast("Arquivo inválido.","error"); } ev.target.value=""; };
  reader.readAsText(f);
}

/* =========================
   Util p/ PDF: carregar imagem (URL -> dataURL)
   ========================= */
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

/* =========================
   PDF (texto) – com métodos do GRID
   ========================= */
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
  const ativos = (r.metodos||[]).filter(m=>m.aplicado);
  if (!ativos.length) {
    paragraph("Nenhum método marcado como aplicado.");
  } else {
    ativos.forEach((m) => {
      ensureSpace(60);
      doc.setFont("helvetica","bold"); doc.setTextColor(THEME.ink);
      doc.text(`• ${m.metodo || "-"}`, MARGIN_X, y); y += 12;
      doc.setFont("helvetica","normal");
      const linhas = [
        m.norma     && `Norma/Ref.: ${m.norma}`,
        m.equip     && `Equipamento: ${m.equip}`,
        m.materiais && `Materiais: ${m.materiais}`,
        m.proced    && `Procedimento: ${m.proced}`,
        m.criterio  && `Critério/Requisito: ${m.criterio}`,
        m.unidade   && `Unidade: ${m.unidade}`,
      ].filter(Boolean).join("\n");
      paragraph(linhas || "-");
      y += 2;
    });
  }

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

  // ===== 9. Imagens — lado a lado (imagem à esquerda; legenda+ALT à direita) com robustez
  if ((r.imagens||[]).length){
    title("9. Imagens");

    const IMG_W = 180;       // largura da imagem
    const IMG_MAX_H = 150;   // altura máxima da imagem
    const GAP_X = 16;        // espaço entre imagem e texto
    const LINE_H = 12;

    try {
      for (let i=0;i<r.imagens.length;i++){
        try{
          const it = r.imagens[i];
          const url = (typeof it === "string") ? it : it.src;
          const legenda = (typeof it === "object" ? it.legenda : "") || `Figura ${i+1}`;
          const altText = (typeof it === "object" ? (it.alt||"") : "");

          const dataUrl = await loadImageAsDataURL(url);
          const img = new Image(); img.src = dataUrl;
          await new Promise(res => { if (img.complete) res(); else img.onload = res; });

          const ratio = img.naturalHeight / img.naturalWidth || 1;
          const imgH = Math.min(IMG_W * ratio, IMG_MAX_H);
          const TEXT_W = Math.max(10, (PAGE_W - 2*MARGIN_X) - IMG_W - GAP_X);

          // bloco cabeçalho/ALT
          doc.setFont("helvetica","bold");  doc.setFontSize(10); doc.setTextColor(THEME.ink);
          const capTitle = `Figura ${i+1}${legenda ? ` — ${legenda}` : ""}`;
          const capLines = doc.splitTextToSize(capTitle, TEXT_W);

          doc.setFont("helvetica","normal"); doc.setFontSize(9);
          const altLines = doc.splitTextToSize(altText ? `ALT: ${altText}` : "(ALT ausente)", TEXT_W);

          const textBlockH = (capLines.length * LINE_H) + 4 + (altLines.length * LINE_H);
          const rowH = Math.max(imgH, textBlockH);

          ensureSpace(rowH + 18);

          const imgX = MARGIN_X;
          const textX = MARGIN_X + IMG_W + GAP_X;

          // imagem + moldura
          doc.setDrawColor(210);
          doc.addImage(dataUrl, "JPEG", imgX, y, IMG_W, imgH);
          doc.rect(imgX-1, y-1, IMG_W+2, imgH+2);

          // legenda
          let ty = y;
          doc.setFont("helvetica","bold"); doc.setFontSize(10); doc.setTextColor(THEME.ink);
          capLines.forEach((ln, idx)=> doc.text(ln, textX, ty + (idx*LINE_H)));
          ty += capLines.length * LINE_H + 4;

          // ALT (vermelho se ausente)
          doc.setFont("helvetica","normal"); doc.setFontSize(9);
          doc.setTextColor(altText ? 90 : THEME.danger);
          altLines.forEach((ln, idx)=> doc.text(ln, textX, ty + (idx*LINE_H)));

          y += rowH + 18;
          doc.setTextColor(THEME.ink);
        }catch{
          ensureSpace(20);
          doc.setFontSize(10); doc.setTextColor(150);
          doc.text(`(Não foi possível carregar uma imagem)`, MARGIN_X, y);
          y += 16; doc.setTextColor(THEME.ink);
        }
      }
    } catch {
      ensureSpace(16);
      doc.setFontSize(10); doc.setTextColor(150);
      doc.text("(Falha ao processar imagens — prosseguindo…)", MARGIN_X, y);
      y += 14; doc.setTextColor(THEME.ink);
    }

    // reset estilo
    doc.setFont("helvetica","normal"); doc.setFontSize(11); doc.setTextColor(THEME.ink);
  }

  // ===== 10. Tabelas adicionais
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

      const linhas = Array.isArray(tbl?.linhas) ? tbl.linhas : (Array.isArray(tbl) ? tbl : []);
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

/* =========================
   PDF (layout HTML) — alternativa visual do DOM
   ========================= */
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

/* ===========================================================
   MÉTODOS – GRID (fieldset 4) – CRUD com animações
   =========================================================== */
const MetGrid = {
  state: [],      // [{id,metodo,norma,equip,materiais,proced,criterio,unidade,aplicado}]
  editId: null,
  inputs: {
    metodo:    "#metMetodo",
    norma:     "#metNorma",
    equip:     "#metEquip",
    materiais: "#metMateriais",
    proced:    "#metProced",
    criterio:  "#metCriterio",
    unidade:   "#metUnidade",
    aplicado:  "#metAplicado",
  },
  getVals(){
    return {
      metodo:    $(this.inputs.metodo).value.trim(),
      norma:     $(this.inputs.norma).value.trim(),
      equip:     $(this.inputs.equip).value.trim(),
      materiais: $(this.inputs.materiais).value.trim(),
      proced:    $(this.inputs.proced).value.trim(),
      criterio:  $(this.inputs.criterio).value.trim(),
      unidade:   $(this.inputs.unidade).value.trim(),
      aplicado:  $(this.inputs.aplicado).checked,
    };
  },
  setVals(v={}){
    $(this.inputs.metodo).value     = v.metodo||"";
    $(this.inputs.norma).value      = v.norma||"";
    $(this.inputs.equip).value      = v.equip||"";
    $(this.inputs.materiais).value  = v.materiais||"";
    $(this.inputs.proced).value     = v.proced||"";
    $(this.inputs.criterio).value   = v.criterio||"";
    $(this.inputs.unidade).value    = v.unidade||"";
    $(this.inputs.aplicado).checked = !!v.aplicado;
  },
  clear(){ this.setVals({}); this.editId=null; $("#btnAddMetodo").textContent="Incluir"; },
  save(){
    const v = this.getVals();
    if(!v.metodo){ toast("Informe o campo ‘Método / Descrição’.","error"); return; }

    if(this.editId){
      const i = this.state.findIndex(m=>m.id===this.editId);
      if(i>=0){
        if (this.state.some((m,ix)=>ix!==i && m.metodo.toLowerCase()===v.metodo.toLowerCase())){
          toast("Já existe um método com essa descrição.","error"); return;
        }
        const ok = confirm(`Confirmar alteração?\n\nDe:\n- ${this.state[i].metodo}\n\nPara:\n- ${v.metodo}`);
        if(!ok) return;
        this.state[i] = {...this.state[i], ...v};
        this.render();
        this.clear();
        toast("Método alterado","success");
      }
    } else {
      if (this.state.some(m=>m.metodo.toLowerCase()===v.metodo.toLowerCase())){
        toast("Já existe um método com essa descrição.","error"); return;
      }
      this.state.push({id:uid(), ...v});
      this.render(true);
      this.clear();
      toast("Método incluído","success");
    }
  },
  edit(id){
    const item = this.state.find(m=>m.id===id); if(!item) return;
    this.setVals(item);
    this.editId = id;
    $("#btnAddMetodo").textContent = "Salvar alteração";
    $(this.inputs.metodo).focus();
    Anim.pulse($(this.inputs.metodo));
  },
  remove(id){
    const item = this.state.find(m=>m.id===id); if(!item) return;
    const ok = confirm(`Tem certeza que deseja excluir o método?\n\n- ${item.metodo}`);
    if(!ok) return;
    this.state = this.state.filter(m=>m.id!==id);
    this.render();
    toast("Método excluído");
  },
  toggleAplicado(id, checked){
    const item = this.state.find(m=>m.id===id); if(!item) return;
    item.aplicado = checked;
  },
  render(scrollToEnd=false){
    const tbody = $("#tblMetodos tbody"); if(!tbody) return;
    if(!this.state.length){
      tbody.innerHTML = `<tr><td colspan="9" class="small">Nenhum método cadastrado. Use o formulário acima para incluir.</td></tr>`;
      return;
    }
    tbody.innerHTML = this.state.map(m=>`
      <tr data-id="${m.id}">
        <td>${escapeHtml(m.metodo||"")}</td>
        <td>${escapeHtml(m.norma||"")}</td>
        <td>${escapeHtml(m.equip||"")}</td>
        <td>${escapeHtml(m.materiais||"")}</td>
        <td>${escapeHtml(m.proced||"")}</td>
        <td>${escapeHtml(m.criterio||"")}</td>
        <td>${escapeHtml(m.unidade||"")}</td>
        <td>
          <label class="inline">
            <input type="checkbox" data-id="${m.id}" ${m.aplicado?"checked":""}/>
            <span class="small">Aplic.</span>
          </label>
        </td>
        <td>
          <div class="inline" style="gap:8px">
            <button type="button" class="btn-mini" data-action="edit" data-id="${m.id}">Alterar</button>
            <button type="button" class="btn-mini danger" data-action="delete" data-id="${m.id}">Excluir</button>
          </div>
        </td>
      </tr>
    `).join("");

    $$("#tblMetodos tbody tr").forEach((tr,i)=> Anim.fadeIn(tr,100+(i*10),4));
    if(scrollToEnd){ tbody.parentElement.scrollTop = tbody.parentElement.scrollHeight; }
  }
};

function initMetodosGrid(){
  const btnAdd = $("#btnAddMetodo");
  const btnClr = $("#btnLimparMetodo");
  const table  = $("#tblMetodos");

  btnAdd?.addEventListener("click", ()=> withEditPerm(()=> MetGrid.save()));
  btnClr?.addEventListener("click", ()=> withEditPerm(()=> MetGrid.clear()));

  table?.addEventListener("click", (ev)=>{
    const btn = ev.target.closest("button[data-action]");
    if(!btn) return;
    const id = btn.getAttribute("data-id");
    if(btn.dataset.action==="edit")   withEditPerm(()=> MetGrid.edit(id));
    if(btn.dataset.action==="delete") withEditPerm(()=> MetGrid.remove(id));
  });

  table?.addEventListener("change", (ev)=>{
    const cb = ev.target.closest('input[type="checkbox"][data-id]');
    if(!cb) return;
    withEditPerm(()=> MetGrid.toggleAplicado(cb.getAttribute("data-id"), cb.checked));
  });
}

/* =========================
   Utilidades diversas
   ========================= */
function escapeHtml(s){
  return String(s||"").replace(/[&<>"']/g, m => (
    {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]
  ));
}

/* =========================
   AUTH (localStorage)
   ========================= */
const STORAGE_USERS = "relatorios-users";
const STORAGE_SESSION = "relatorios-session";

function nowIso(){ return new Date().toISOString(); }
async function sha256(txt){
  const enc = new TextEncoder().encode(txt);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,"0")).join("");
}

function loadUsers(){
  try{ return JSON.parse(localStorage.getItem(STORAGE_USERS))||[] }catch{ return []; }
}
function saveUsers(list){
  localStorage.setItem(STORAGE_USERS, JSON.stringify(list));
}
function getSession(){
  try{ return JSON.parse(localStorage.getItem(STORAGE_SESSION))||null }catch{ return null; }
}
function setSession(sess){
  if(sess) localStorage.setItem(STORAGE_SESSION, JSON.stringify(sess));
  else localStorage.removeItem(STORAGE_SESSION);
}

/* cria admin padrão no 1º uso */
async function ensureDefaultAdmin(){
  const users = loadUsers();
  if(!users.length){
    const passhash = await sha256("admin123");
    users.push({
      id: uid(),
      nome: "Administrador",
      email: "admin@local",
      pass: passhash,
      role: "admin",
      updatedAt: nowIso()
    });
    saveUsers(users);
  }
}

/* UI helpers */
function lockUI(locked=true){
  document.body.classList.toggle("locked", locked);
  const auth = $("#authScreen");
  if(auth) auth.style.display = locked ? "grid" : "none";
}
function renderWhoAmI(){
  const s = getSession();
  const who = $("#whoami");
  if(who) who.textContent = s ? `${s.nome} (${s.role})` : "—";
}

/* controle de permissão */
function hasRole(...roles){
  const s = getSession();
  return !!(s && roles.includes(s.role));
}

/* aplica/retira disabled nos elementos conforme papel */
function applyRolePermissions(){
  const canEdit = hasRole("admin","editor");

  // campos do formulário
  $$("#formRelatorio input, #formRelatorio textarea, #formRelatorio select, #formRelatorio button").forEach(el=>{
    // whitelist sempre habilitada:
    const id = el.id || "";
    const always = ["btnPDF","btnPDFhtml","btnImprimir","btnExportar"];
    if(always.includes(id)) return;
    el.disabled = !canEdit;
  });

  // botões do topo fora do form
  $("#btnNovo")?.toggleAttribute("disabled", !canEdit);
  $("#btnSalvar")?.toggleAttribute("disabled", !canEdit);
  $("#inputImportar")?.toggleAttribute("disabled", !canEdit);

  // acesso ao módulo de usuários: só admin
  $("#btnUsers")?.toggleAttribute("disabled", !hasRole("admin"));
}

/* ===== Login / Logout ===== */
async function doLogin(email, password){
  const users = loadUsers();
  const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if(!user) throw new Error("Usuário não encontrado.");
  const hash = await sha256(password);
  if(user.pass !== hash) throw new Error("Senha incorreta.");
  setSession({ id:user.id, nome:user.nome, email:user.email, role:user.role, ts:Date.now() });
  renderWhoAmI();
}

function doLogout(){
  setSession(null);
  lockUI(true);
  renderWhoAmI();
  applyRolePermissions();
  toast("Sessão encerrada");
}

/* ===== CRUD de usuários (admin) ===== */
function usersRenderTable(){
  const tbody = $("#tblUsers tbody");
  if(!tbody) return;
  const list = loadUsers().sort((a,b)=>a.nome.localeCompare(b.nome));
  tbody.innerHTML = list.map(u=>`
    <tr data-id="${u.id}">
      <td>${escapeHtml(u.nome)}</td>
      <td>${escapeHtml(u.email)}</td>
      <td>${escapeHtml(u.role)}</td>
      <td>${new Date(u.updatedAt).toLocaleString()}</td>
    </tr>`).join("");
}

function usersFillForm(u){
  $("#uNome").value = u?.nome || "";
  $("#uEmail").value = u?.email || "";
  $("#uSenha").value = "";
  $("#uRole").value = u?.role || "editor";
  $("#userForm").dataset.editingId = u?.id || "";
}

async function usersSaveOrUpdate(){
  if(!hasRole("admin")){ toast("Apenas administradores podem gerenciar usuários.","error"); return; }
  const nome = $("#uNome").value.trim();
  const email = $("#uEmail").value.trim();
  const senha = $("#uSenha").value;
  const role = $("#uRole").value;

  if(!nome || !email) { toast("Nome e e-mail são obrigatórios.","error"); return; }
  const editingId = $("#userForm").dataset.editingId || null;
  const list = loadUsers();

  if(editingId){
    const i = list.findIndex(u=>u.id===editingId);
    if(i<0){ toast("Usuário não encontrado.","error"); return; }
    if(list.some((u,ix)=>ix!==i && u.email.toLowerCase()===email.toLowerCase())){
      toast("Já existe usuário com esse e-mail.","error"); return;
    }
    list[i].nome = nome;
    list[i].email = email;
    list[i].role = role;
    if(senha){ list[i].pass = await sha256(senha); }
    list[i].updatedAt = nowIso();
  } else {
    if(list.some(u=>u.email.toLowerCase()===email.toLowerCase())){
      toast("Já existe usuário com esse e-mail.","error"); return;
    }
    list.push({
      id: uid(),
      nome, email, role,
      pass: senha ? await sha256(senha) : await sha256(Math.random().toString(36).slice(2,10)),
      updatedAt: nowIso()
    });
  }
  saveUsers(list);
  usersRenderTable();
  usersFillForm(null);
  toast("Usuário salvo/atualizado","success");
}

function usersDelete(){
  if(!hasRole("admin")){ toast("Apenas administradores podem excluir usuários.","error"); return; }
  const editingId = $("#userForm").dataset.editingId || null;
  if(!editingId){ toast("Selecione um usuário na tabela.","error"); return; }
  const list = loadUsers();
  const user = list.find(u=>u.id===editingId);
  if(!user) return;
  if(!confirm(`Excluir o usuário:\n\n${user.nome} <${user.email}> ?`)) return;
  if(user.role==="admin" && list.filter(u=>u.role==="admin").length===1){
    toast("Não é possível excluir o único admin.","error"); return;
  }
  saveUsers(list.filter(u=>u.id!==editingId));
  usersRenderTable();
  usersFillForm(null);
  toast("Usuário excluído");
}

/* ===== Export/Import ===== */
function exportUsersJSON(){
  const data = loadUsers();
  const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob);
  a.download=`usuarios-relatorios.json`;
  a.click(); URL.revokeObjectURL(a.href);
  toast("Usuários exportados","success");
}
function importUsersJSON(ev){
  const f=ev.target.files?.[0]; if(!f) return;
  const reader=new FileReader();
  reader.onload=()=>{ try{
    const data=JSON.parse(reader.result);
    if(!Array.isArray(data)) throw new Error("Formato inválido");
    const ok = data.every(u=>u.id && u.email && u.pass && u.role);
    if(!ok) throw new Error("Campos obrigatórios ausentes.");
    saveUsers(data);
    toast("Usuários importados","success");
  }catch(e){ toast("Arquivo inválido: "+e.message,"error"); }
  ev.target.value=""; };
  reader.readAsText(f);
}

/* ===== Bind de eventos de Auth e Usuários ===== */
function bindAuthEvents(){
  // Login
  $("#loginForm")?.addEventListener("submit", async (e)=>{
    e.preventDefault();
    const email = $("#loginEmail").value.trim();
    const password = $("#loginPassword").value;
    try{
      await doLogin(email, password);
      $("#loginPassword").value = "";
      lockUI(false);
      renderWhoAmI();
      applyRolePermissions();
      toast("Bem-vindo(a)!", "success");
    }catch(err){
      toast(err.message || "Falha no login.","error");
    }
  });

  // Logout
  $("#btnLogout")?.addEventListener("click", doLogout);

  // Abrir gerenciador de usuários (admin)
  $("#btnUsers")?.addEventListener("click", ()=>{
    if(!hasRole("admin")){ toast("Apenas administradores.","error"); return; }
    usersRenderTable();
    usersFillForm(null);
    $("#dlgUsers")?.showModal();
  });

  // Ações no gerenciador
  $("#btnUserSave")?.addEventListener("click", usersSaveOrUpdate);
  $("#btnUserNew")?.addEventListener("click", ()=> usersFillForm(null));
  $("#btnUserDelete")?.addEventListener("click", usersDelete);

  // Seleção de linha da tabela de usuários
  $("#tblUsers")?.addEventListener("click", (e)=>{
    const tr = e.target.closest("tr[data-id]");
    if(!tr) return;
    const id = tr.dataset.id;
    const u = loadUsers().find(x=>x.id===id);
    if(u) usersFillForm(u);
  });

  // Export/Import de usuários (card de login)
  $("#btnExportUsers")?.addEventListener("click", exportUsersJSON);
  $("#inputImportUsers")?.addEventListener("change", importUsersJSON);
}
