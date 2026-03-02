function $(sel, root = document) {
  return root.querySelector(sel);
}

function $all(sel, root = document) {
  return Array.from(root.querySelectorAll(sel));
}

function normalizeCsv(value) {
  return String(value || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function safeText(v) {
  return String(v || "").trim();
}

function addRepeatable(listEl, tplEl) {
  const node = tplEl.content.cloneNode(true);
  listEl.appendChild(node);
}

function gatherRepeatables(listEl, mapFn) {
  const items = $all(".repeatable-item", listEl);
  return items.map(mapFn).filter((x) => x != null);
}

function formDataToObject(formEl) {
  const fd = new FormData(formEl);
  const obj = {};
  for (const [k, v] of fd.entries()) obj[k] = v;
  return obj;
}

function mustHaveJsPdf() {
  const jspdf = window.jspdf;
  if (!jspdf || !jspdf.jsPDF) {
    throw new Error("No se pudo cargar jsPDF. Revisa tu conexión a Internet o el CDN.");
  }
  return jspdf;
}

function generateCvPdf(data) {
  const { jsPDF } = mustHaveJsPdf().jsPDF ? window.jspdf : mustHaveJsPdf();
  const doc = new jsPDF({ unit: "pt", format: "a4" });

  const page = {
    w: doc.internal.pageSize.getWidth(),
    h: doc.internal.pageSize.getHeight(),
  };
  const margin = 44;
  const maxW = page.w - margin * 2;

  let y = margin;

  function ensureSpace(needed) {
    if (y + needed <= page.h - margin) return;
    doc.addPage();
    y = margin;
  }

  function addTitle(text) {
    const t = safeText(text);
    if (!t) return;
    ensureSpace(28);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text(t, margin, y);
    y += 22;
  }

  function addSubTitle(text) {
    const t = safeText(text);
    if (!t) return;
    ensureSpace(18);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.setTextColor(80);
    doc.text(t, margin, y);
    doc.setTextColor(0);
    y += 14;
  }

  function addSection(text) {
    const t = safeText(text);
    if (!t) return;
    ensureSpace(22);
    y += 6;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(t.toUpperCase(), margin, y);
    y += 10;
    doc.setDrawColor(200);
    doc.line(margin, y, page.w - margin, y);
    y += 14;
  }

  function addParagraph(text) {
    const t = safeText(text);
    if (!t) return;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    const lines = doc.splitTextToSize(t, maxW);
    ensureSpace(lines.length * 14 + 4);
    doc.text(lines, margin, y);
    y += lines.length * 14 + 6;
  }

  function addBulletList(items) {
    const list = (items || []).map(safeText).filter(Boolean);
    if (!list.length) return;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    const bulletIndent = 10;
    const textIndent = 18;

    for (const it of list) {
      const lines = doc.splitTextToSize(it, maxW - textIndent);
      ensureSpace(lines.length * 14 + 6);
      doc.text("•", margin + bulletIndent - 6, y);
      doc.text(lines, margin + textIndent, y);
      y += lines.length * 14 + 2;
    }
    y += 6;
  }

  function addEntry(title, meta, body) {
    const t = safeText(title);
    const m = safeText(meta);
    const b = safeText(body);
    if (!t && !m && !b) return;

    ensureSpace(40);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    if (t) doc.text(t, margin, y);

    if (m) {
      doc.setFont("helvetica", "normal");
      doc.setTextColor(90);
      doc.text(m, page.w - margin, y, { align: "right" });
      doc.setTextColor(0);
    }
    y += 14;

    if (b) addParagraph(b);
    else y += 6;
  }

  const fullName = safeText(data.fullName);
  const role = safeText(data.role);
  const email = safeText(data.email);
  const phone = safeText(data.phone);
  const location = safeText(data.location);
  const links = normalizeCsv(data.links);
  const summary = safeText(data.summary);
  const skills = normalizeCsv(data.skills);
  const languages = normalizeCsv(data.languages);

  addTitle(fullName || "Currículum");
  addSubTitle(role);

  const headerLine = [email, phone, location].filter(Boolean).join(" · ");
  if (headerLine) addParagraph(headerLine);
  if (links.length) addParagraph(links.join(" · "));

  if (summary) {
    addSection("Resumen");
    addParagraph(summary);
  }

  if (skills.length) {
    addSection("Habilidades");
    addBulletList(skills);
  }

  if (data.education && data.education.length) {
    addSection("Educación");
    for (const e of data.education) {
      const title = [e.degree, e.institution].filter(Boolean).join(" — ");
      const meta = [e.start, e.end].filter(Boolean).join(" - ");
      addEntry(title, meta, e.desc);
    }
  }

  if (data.experience && data.experience.length) {
    addSection("Experiencia");
    for (const e of data.experience) {
      const title = [e.title, e.company].filter(Boolean).join(" — ");
      const meta = [e.start, e.end].filter(Boolean).join(" - ");
      addEntry(title, meta, e.desc);
    }
  }

  if (languages.length) {
    addSection("Idiomas");
    addBulletList(languages);
  }

  return doc;
}

function getCvData() {
  const formEl = $("#cvForm");
  const base = formDataToObject(formEl);

  const education = gatherRepeatables($("#educationList"), (item) => {
    const institution = safeText($("[name='eduInstitution']", item)?.value);
    const degree = safeText($("[name='eduDegree']", item)?.value);
    const start = safeText($("[name='eduStart']", item)?.value);
    const end = safeText($("[name='eduEnd']", item)?.value);
    const desc = safeText($("[name='eduDesc']", item)?.value);
    if (![institution, degree, start, end, desc].some(Boolean)) return null;
    return { institution, degree, start, end, desc };
  });

  const experience = gatherRepeatables($("#experienceList"), (item) => {
    const company = safeText($("[name='expCompany']", item)?.value);
    const title = safeText($("[name='expTitle']", item)?.value);
    const start = safeText($("[name='expStart']", item)?.value);
    const end = safeText($("[name='expEnd']", item)?.value);
    const desc = safeText($("[name='expDesc']", item)?.value);
    if (![company, title, start, end, desc].some(Boolean)) return null;
    return { company, title, start, end, desc };
  });

  return { ...base, education, experience };
}

function attachRemoveHandlers() {
  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".js-remove");
    if (!btn) return;
    const item = btn.closest(".repeatable-item");
    if (item) item.remove();
  });
}

function fillExample() {
  $("#fullName").value = "Ana Pérez";
  $("#role").value = "Desarrolladora Frontend";
  $("#email").value = "ana.perez@email.com";
  $("#phone").value = "+34 600 000 000";
  $("#location").value = "Madrid, España";
  $("#links").value = "https://linkedin.com/in/anaperez, https://github.com/anaperez";
  $("#summary").value =
    "Frontend con 3+ años construyendo interfaces rápidas y accesibles. Experiencia con React, diseño de componentes y buenas prácticas de UX. Enfocada en calidad, performance y colaboración.";
  $("#skills").value = "HTML, CSS, JavaScript, React, TypeScript, Accesibilidad, Git";
  $("#languages").value = "Español (nativo), Inglés (B2)";

  const eduList = $("#educationList");
  eduList.innerHTML = "";
  addRepeatable(eduList, $("#tplEducation"));
  const eduItem = $(".repeatable-item", eduList);
  $("[name='eduInstitution']", eduItem).value = "Universidad Ejemplo";
  $("[name='eduDegree']", eduItem).value = "Grado en Ingeniería Informática";
  $("[name='eduStart']", eduItem).value = "2018";
  $("[name='eduEnd']", eduItem).value = "2022";
  $("[name='eduDesc']", eduItem).value = "Proyecto final: aplicación web con enfoque en accesibilidad.";

  const expList = $("#experienceList");
  expList.innerHTML = "";
  addRepeatable(expList, $("#tplExperience"));
  const expItem = $(".repeatable-item", expList);
  $("[name='expCompany']", expItem).value = "Tech S.A.";
  $("[name='expTitle']", expItem).value = "Frontend Developer";
  $("[name='expStart']", expItem).value = "2023";
  $("[name='expEnd']", expItem).value = "Actual";
  $("[name='expDesc']", expItem).value =
    "Desarrollo de componentes reutilizables, optimización de rendimiento (LCP/CLS), mejoras de accesibilidad (WCAG) y colaboración con diseño y backend.";
}

function main() {
  const eduList = $("#educationList");
  const expList = $("#experienceList");
  const tplEdu = $("#tplEducation");
  const tplExp = $("#tplExperience");

  // Empieza con 1 bloque en cada sección para que sea más cómodo.
  addRepeatable(eduList, tplEdu);
  addRepeatable(expList, tplExp);

  $("#addEducation").addEventListener("click", () => addRepeatable(eduList, tplEdu));
  $("#addExperience").addEventListener("click", () => addRepeatable(expList, tplExp));

  $("#fillExample").addEventListener("click", fillExample);

  $("#generatePdf").addEventListener("click", () => {
    const fullName = safeText($("#fullName").value);
    if (!fullName) {
      $("#fullName").focus();
      alert("Por favor, escribe tu nombre completo.");
      return;
    }

    try {
      const data = getCvData();
      const doc = generateCvPdf(data);
      const fileSafeName = fullName.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "_") || "cv";
      doc.save(`CV_${fileSafeName}.pdf`);
    } catch (err) {
      alert(err?.message || "Error generando el PDF.");
    }
  });

  attachRemoveHandlers();
}

main();
