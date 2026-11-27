/* دهم ریاضی سعدی — guest-first static learning app.
 * Storage key saadi-v1 is retained so existing guest progress and question IDs survive recovery.
 */
const $ = (selector) => document.querySelector(selector);
const root = $('#app');
const STORAGE_KEY = 'saadi-v1';
const CATEGORIES = {
  concept: { title: 'مفاهیم و تعاریف', label: 'مفاهیم', icon: '◈', description: 'تعریف‌ها، نمادها، ویژگی‌ها و استدلال‌های مفهومی' },
  problem: { title: 'مسائل و محاسبات', label: 'محاسبات', icon: '∑', description: 'تمرین‌های عددی، محاسباتی و مسئله‌های چندمرحله‌ای' }
};
const freshState = () => ({ name: '', answers: {}, xp: 0, completed: [], completionRewards: [], daily: {}, exams: [] });
let state;
let storageAvailable = true;
try {
  state = { ...freshState(), ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') };
  state.answers ||= {};
  state.daily ||= {};
  state.exams ||= [];
  state.completed ||= [];
  state.completionRewards ||= [];
  state.xp = Number.isFinite(Number(state.xp)) ? Number(state.xp) : 0;
} catch {
  state = freshState();
  storageAvailable = false;
}
let page = 'home';
let lessonIndex = 0;
let session = null;
let timer = null;
const allQuestions = lessons.flatMap((lesson) => lesson.q);

const fa = (value) => String(value).replace(/\d/g, (digit) => '۰۱۲۳۴۵۶۷۸۹'[digit]);
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[character]);
const percent = (part, total) => total ? Math.round((part * 100) / total) : 0;
const questionsFor = (lesson, category) => lessons[lesson].q.filter((question) => question.category === category);
const isAnswered = (question) => Object.prototype.hasOwnProperty.call(state.answers, question.id);
const answeredQuestions = (questions) => questions.filter(isAnswered);
const correctQuestions = (questions) => answeredQuestions(questions).filter((question) => state.answers[question.id].correct);
const aggregateAttempted = () => Object.keys(state.answers).length;
const aggregateCorrect = () => Object.values(state.answers).filter((answer) => answer && answer.correct).length;
const completedLessons = () => lessons.filter((lesson) => lesson.q.every(isAnswered)).length;
const userLevel = () => Math.floor(state.xp / 100) + 1;

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    storageAvailable = true;
  } catch {
    storageAvailable = false;
  }
}

function today() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function normalizeNumber(value) {
  return String(value)
    .trim()
    .replace(/[۰-۹]/g, (digit) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(digit))
    .replace(/[٠-٩]/g, (digit) => '٠١٢٣٤٥٦٧٨٩'.indexOf(digit))
    .replace(/[−–]/g, '-')
    .replace(/[٫،]/g, '.')
    .replace(/٬/g, '')
    .replace(/\s/g, '');
}

function isCorrect(question, value) {
  if (question.options) return Number(value) === Number(question.answer);
  const normalized = normalizeNumber(value);
  return normalized !== '' && Number.isFinite(Number(normalized)) && Number(normalized) === Number(question.answer);
}

function toLatex(expression) {
  if (expression.includes('\\')) return expression;
  const unicode = {
    '∪': '\\cup', '∩': '\\cap', '∈': '\\in', '∉': '\\notin', '⊆': '\\subseteq', '⊇': '\\supseteq',
    '∅': '\\varnothing', 'ℕ': '\\mathbb{N}', 'ℤ': '\\mathbb{Z}', 'ℚ': '\\mathbb{Q}', 'ℝ': '\\mathbb{R}', '△': '\\triangle',
    '≤': '\\leq', '≥': '\\geq', '×': '\\times', '÷': '\\div', '∞': '\\infty', '′': "^{\\prime}",
    '−': '-', '–': '-', '٫': '.', '،': ',', '٬': '', '½': '\\frac{1}{2}', '¼': '\\frac{1}{4}', '¾': '\\frac{3}{4}',
    '⅓': '\\frac{1}{3}', '⅔': '\\frac{2}{3}', '√': '\\sqrt{}'
  };
  let result = String(expression)
    .replace(/[۰-۹]/g, (digit) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(digit))
    .replace(/[٠-٩]/g, (digit) => '٠١٢٣٤٥٦٧٨٩'.indexOf(digit));
  result = result.replaceAll('{', '\\{').replaceAll('}', '\\}');
  result = result.replace(/(\d+)\s*\/\s*(\d+)/g, '\\frac{$1}{$2}')
    .replace(/√\s*([0-9A-Za-z]+)/g, '\\sqrt{$1}')
    .replace(/[₀-₉ₐ-ₜ]/g, (character) => {
    const subscripts = { '₀':'0','₁':'1','₂':'2','₃':'3','₄':'4','₅':'5','₆':'6','₇':'7','₈':'8','₉':'9','ₐ':'a','ₙ':'n','ₘ':'m','ₓ':'x','ₖ':'k','ₜ':'t' };
    return `_{${subscripts[character] || character}}`;
  }).replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹ⁿ]/g, (character) => {
    const superscripts = { '⁰':'0','¹':'1','²':'2','³':'3','⁴':'4','⁵':'5','⁶':'6','⁷':'7','⁸':'8','⁹':'9','ⁿ':'n' };
    return `^{${superscripts[character]}}`;
  });
  result = result.replace(/[∪∩∈∉⊆⊇∅ℕℤℚℝ≤≥×÷∞′−–٫،٬½¼¾⅓⅔√△]/g, (character) => unicode[character] || character);
  return result;
}

function renderExpression(expression) {
  const source = String(expression).trim();
  if (!source) return '';
  if (window.katex) {
    try {
      return `<span class="math-run" dir="ltr">${window.katex.renderToString(toLatex(source), { throwOnError: false, strict: 'ignore' })}</span>`;
    } catch { /* fall through to a direction-isolated literal */ }
  }
  return `<bdi class="math-run" dir="ltr">${escapeHtml(source)}</bdi>`;
}

// Find math fragments in the recovered plain-text exercise bank and typeset those LTR.
const mathFragment = /\|[A-Za-z][A-Za-z0-9₀-₉ₐ-ₜ⁰-ⁿ]*\|(?:\s*(?:=|≤|≥|<|>)\s*[0-9۰-۹٠-٩]+)?|\{[^{}]*\}|[\[(]\s*[۰-۹0-9−-]+\s*[،,]\s*[۰-۹0-9−-]+\s*[\])]|√\s*[۰-۹٠-٩0-9]+|(?:[A-Za-z][A-Za-z0-9₀-₉ₐ-ₜ⁰-ⁿ′']*\s*(?:=|≤|≥|<|>|∈|∉|⊆|∪|∩|−|\+|-|×|÷|\/|\^)\s*[A-Za-z0-9۰-۹٠-٩₀-₉ₐ-ₜ⁰-ⁿℕℤℚℝ∅′'{}()[\]−+×÷=≤≥<>،,.|/^]*)|(?:[-−]?[0-9۰-۹٠-٩]+(?:\s*(?:=|≤|≥|<|>|∈|∪|∩|−|\+|-|×|÷|\/|،|,)\s*[A-Za-z0-9۰-۹٠-٩₀-₉ₐ-ₜ⁰-ⁿ]+)+)|[A-Za-z][A-Za-z0-9₀-₉ₐ-ₜ⁰-ⁿ]*|[½¼¾⅓⅔]/g;
function mathText(text) {
  const source = String(text);
  let html = '';
  let last = 0;
  for (const match of source.matchAll(mathFragment)) {
    html += escapeHtml(source.slice(last, match.index));
    html += renderExpression(match[0]);
    last = match.index + match[0].length;
  }
  return html + escapeHtml(source.slice(last));
}

function stat(icon, label, value) {
  return `<div class="stat"><div class="icon" aria-hidden="true">${icon}</div><div><small>${label}</small><strong>${value}</strong></div></div>`;
}

const navItems = [
  ['home', '⌂', 'خانه'], ['lessons', '▦', 'درس‌ها'], ['exam', '◷', 'آزمون'],
  ['daily', '✦', 'چالش روزانه'], ['achievements', '♧', 'دستاوردها'], ['stats', '▥', 'آمار من'], ['about', 'ⓘ', 'درباره']
];

function go(nextPage) {
  clearInterval(timer);
  timer = null;
  session = null;
  page = nextPage;
  render();
  window.scrollTo(0, 0);
}

function shell(body) {
  const links = navItems.map(([id, icon, title]) => `<button class="${page === id ? 'active' : ''}" ${page === id ? 'aria-current="page"' : ''} onclick="go('${id}')"><span aria-hidden="true">${icon}</span>${title}</button>`).join('');
  const mobileLinks = navItems.map(([id, icon, title]) => `<button class="${page === id ? 'active' : ''}" ${page === id ? 'aria-current="page"' : ''} onclick="go('${id}')"><span aria-hidden="true">${icon}</span>${title}</button>`).join('');
  return `<aside class="sidebar"><div class="brand"><div class="brand-icon" aria-hidden="true">∑</div><div>دهم ریاضی سعدی<br><small>SAADI MATH</small></div></div><div class="navlabel">منوی اصلی</div><nav class="nav" aria-label="منوی اصلی">${links}</nav><div class="sidebottom">✦ هر روز، یک قدم جلوتر<br>یاد بگیر، تمرین کن، پیشرفت کن.<div class="brand-credit">طراحی و توسعه<br><strong>آرمان · Arman Es</strong></div></div></aside><main class="main"><div class="content"><header class="top"><span>دهم ریاضی سعدی &nbsp; / &nbsp; <strong>${navItems.find((item) => item[0] === page)?.[2] || 'یادگیری'}</strong></span><span class="pill">✦ ${fa(state.xp)} XP${state.name ? ` &nbsp; · &nbsp; ${escapeHtml(state.name)}` : ''}</span></header>${!storageAvailable ? '<div class="feedback bad" role="status">ذخیره‌سازی محلی در دسترس نیست؛ این نشست ممکن است پس از بستن صفحه از بین برود.</div>' : ''}${body}<footer class="footer-credit">Made by <strong class="copyright">Arman Es</strong> · طراحی و توسعه: آرمان · یاد بگیر، تمرین کن، پیشرفت کن.</footer></div></main><nav class="mobile" aria-label="ناوبری موبایل">${mobileLinks}</nav>${state.name ? '' : onboarding()}`;
}

function onboarding() {
  return `<div class="modalwrap"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="welcome-title"><div class="brand-icon" style="margin:0 auto" aria-hidden="true">∑</div><h1 id="welcome-title">به دهم ریاضی سعدی خوش اومدی!</h1><p>یاد بگیر، تمرین کن، پیشرفت کن.<br>برای شروع، نام نمایشی دلخواهت رو خودت وارد کن.</p><form onsubmit="event.preventDefault();setName()"><label for="display-name">نام نمایشی</label><input id="display-name" maxlength="32" autocomplete="nickname" placeholder="مثلاً: آرمان" required><button class="btn" style="width:100%" type="submit">شروع یادگیری ←</button></form><p class="notice">بدون ثبت‌نام، ایمیل یا شمارهٔ تلفن. نام و پیشرفت فقط در حافظهٔ همین مرورگر ذخیره می‌شوند.</p></section></div>`;
}

function setName() {
  const field = $('#display-name');
  const name = field?.value.trim();
  if (!name) { field?.focus(); return; }
  state.name = name.slice(0, 32);
  saveState();
  render();
}

function categoryStatistics(lesson, category) {
  const questions = questionsFor(lesson, category);
  const attempted = answeredQuestions(questions).length;
  const correct = correctQuestions(questions).length;
  return { questions, attempted, correct, accuracy: percent(correct, attempted), progress: percent(attempted, questions.length), xp: correct * 10 };
}

function categoryPanel(lesson, category, compact = false) {
  const info = CATEGORIES[category];
  const stats = categoryStatistics(lesson, category);
  const id = `${lesson}-${category}`;
  return `<article class="category-card"><div class="category-kicker">${info.icon} ${info.title}</div><p class="notice">${info.description}</p><div class="category-metrics"><div class="mini-stat"><small>پاسخ‌داده‌شده</small><strong>${fa(stats.attempted)} / ${fa(stats.questions.length)}</strong></div><div class="mini-stat"><small>دقت</small><strong>${fa(stats.accuracy)}٪</strong></div><div class="mini-stat"><small>امتیاز تمرین</small><strong>${fa(stats.xp)} XP</strong></div></div><div class="row"><span>پیشرفت این بانک</span><span>${fa(stats.progress)}٪</span></div><div class="track"><div class="fill" style="width:${stats.progress}%"></div></div><div class="controls"><label class="inline-note" for="difficulty-${id}">سطح</label><select id="difficulty-${id}" aria-label="سطح ${info.title}"><option value="all">ترکیبی</option><option value="آسان">آسان</option><option value="متوسط">متوسط</option><option value="سخت">سخت</option></select><button class="btn ${compact ? 'small' : ''}" onclick="startPractice(${lesson},'${category}',$('#difficulty-${id}').value)">تمرین ${info.label} ←</button></div></article>`;
}

function lessonCard(index) {
  const lesson = lessons[index];
  const total = lesson.q.length;
  const done = lesson.q.filter(isAnswered).length;
  const progress = percent(done, total);
  return `<article class="card"><div class="cardtop"><div class="icon" aria-hidden="true">${lesson.icon}</div><span class="tag">${done === total ? 'تکمیل‌شده ✓' : `درس ${fa(index + 1)}`}</span></div><h3>${fa(index + 1)}. ${lesson.title}</h3><p>${lesson.desc}</p><div class="row"><span>پیشرفت درس</span><span>${fa(progress)}٪</span></div><div class="track"><div class="fill" style="width:${progress}%"></div></div><div class="row"><span>◫ ${fa(total)} سؤال · دو بانک مستقل</span><button class="link" onclick="openLesson(${index})">مشاهده درس ←</button></div></article>`;
}

function openLesson(index) { lessonIndex = index; go('lesson'); }

function homePage() {
  const total = allQuestions.length;
  const progress = percent(aggregateAttempted(), total);
  return `<section class="hero"><div><div class="eyebrow">✦ &nbsp; مسیر یادگیری تو</div><h1>سلام ${escapeHtml(state.name)}، خوش اومدی!</h1><p>آماده‌ای امروز یه قدم به هدفت نزدیک‌تر بشی؟</p><button class="btn" onclick="continuePractice()">ادامهٔ تمرین ←</button></div><div class="hero-art" aria-hidden="true">∑</div></section><div class="stats">${stat('◔','پیشرفت کل سؤال‌ها',fa(progress)+'٪')}${stat('▤','سؤال پاسخ‌داده‌شده',fa(aggregateAttempted()))}${stat('✓','پاسخ درست در تلاش اول',fa(aggregateCorrect()))}${stat('✦','امتیاز تجربه',fa(state.xp)+' XP')}</div><div class="grid"><div><div class="section"><div><h2>فصل اول: مجموعه، الگو و دنباله</h2><p>چهار درس را با دو مسیر مستقل تمرین کن.</p></div><button class="link" onclick="go('lessons')">همهٔ درس‌ها ←</button></div><div class="cards">${lessons.map((_, index) => lessonCard(index)).join('')}</div></div><aside><div class="panel daily"><span style="font-size:30px" aria-hidden="true">✧</span><br><span class="tag">یک فرصت تازه در هر روز</span><h3>چالش روزانه</h3><p>هر روز یک سؤال تازه حل کن و با پاسخ درست ۳۰ امتیاز بگیر.</p><button class="btn secondary" style="width:100%" onclick="go('daily')">${state.daily[today()] ? 'مشاهدهٔ چالش امروز ✓' : 'شروع چالش روزانه ←'}</button></div><div class="panel"><h3>✦ مسیر پیشرفت</h3><p class="notice">سطح ${fa(userLevel())} · ${fa(completedLessons())} درس کامل‌شده</p><div class="track"><div class="fill" style="width:${state.xp % 100}%"></div></div><button class="link" onclick="go('achievements')">دیدن دستاوردها ←</button></div><div class="panel"><h3>دربارهٔ سازنده</h3><p class="notice">Created by <bdi dir="ltr">Arman Es</bdi><br>طراحی و توسعه: آرمان</p></div></aside></div>`;
}

function lessonPage() {
  const lesson = lessons[lessonIndex];
  const totalDone = lesson.q.filter(isAnswered).length;
  const total = lesson.q.length;
  const formula = window.katex ? window.katex.renderToString(lesson.formula, { displayMode: true, throwOnError: false, strict: 'ignore' }) : `<bdi dir="ltr">${escapeHtml(lesson.formula)}</bdi>`;
  return `<button class="back" onclick="go('lessons')">→ بازگشت به درس‌ها</button><div class="section"><div><div class="eyebrow">درس ${fa(lessonIndex + 1)} از ${fa(lessons.length)}</div><h1 class="title">${lesson.title}</h1><p>${lesson.desc}</p></div><span class="tag">${fa(totalDone)} از ${fa(total)} سؤال</span></div><div class="detail"><section class="panel"><h2>مرور درس</h2><p class="prose">${mathText(lesson.text)}</p><div class="formula" dir="ltr" aria-label="فرمول درس">${formula}</div><p class="notice">فرمول‌ها چپ‌به‌راست نمایش داده می‌شوند؛ متن فارسی راست‌به‌چپ است.</p></section><aside class="panel"><h2>دو مسیر تمرین مستقل</h2><p class="notice">پیشرفت، دقت، سطح‌بندی و امتیاز هر بانک جداگانه ذخیره می‌شود.</p><div class="row"><span>پیشرفت کل درس</span><span>${fa(percent(totalDone, total))}٪</span></div><div class="track"><div class="fill" style="width:${percent(totalDone, total)}%"></div></div><p class="notice">${fa(totalDone)} از ${fa(total)} سؤال این درس پاسخ داده شده است.</p><button class="btn secondary" onclick="startLessonExam(${lessonIndex})">آزمون این درس ←</button></aside></div><div class="section"><div><h2>بانک‌های تمرین</h2><p>هر دسته آمار و امتیاز اختصاصی خودش را دارد.</p></div></div><div class="category-grid">${categoryPanel(lessonIndex, 'concept')}${categoryPanel(lessonIndex, 'problem')}</div>`;
}

function lessonListPage() {
  return `<h1 class="title">درس‌های فصل اول</h1><p class="subtitle">مسیر یادگیری‌ات رو از هرجا که دوست داری شروع کن.</p><div class="cards">${lessons.map((_, index) => lessonCard(index)).join('')}</div>`;
}

function shuffle(items) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

function continuePractice() {
  for (let index = 0; index < lessons.length; index += 1) {
    for (const category of Object.keys(CATEGORIES)) {
      const bank = questionsFor(index, category);
      if (bank.some((question) => !isAnswered(question))) return startPractice(index, category, 'all');
    }
  }
  startPractice(0, 'concept', 'all');
}

function startPractice(index, category, difficulty = 'all') {
  lessonIndex = index;
  const bank = questionsFor(index, category).filter((question) => difficulty === 'all' || question.difficulty === difficulty);
  const unanswered = shuffle(bank.filter((question) => !isAnswered(question)));
  const answered = shuffle(bank.filter(isAnswered));
  const questions = [...unanswered, ...answered];
  if (!questions.length) return;
  session = { type: 'practice', category, questions, index: 0, results: [], selected: null, locked: false, current: null };
  page = 'practice';
  render();
  window.scrollTo(0, 0);
}

function displayedAnswer(question, value) {
  if (value === undefined || value === null || String(value).trim() === '') return 'بدون پاسخ';
  return question.options ? mathText(question.options[Number(value)] ?? 'بدون پاسخ') : mathText(String(value));
}

function expectedAnswer(question) {
  return question.options ? mathText(question.options[Number(question.answer)]) : mathText(fa(question.answer));
}

function submitPracticeAnswer() {
  const question = session.questions[session.index];
  const value = question.options ? session.selected : $('#numeric-answer')?.value;
  if (value === null || value === undefined || String(value).trim() === '') {
    alert('اول پاسخ خودت رو وارد کن.');
    return;
  }
  if (!question.options && !Number.isFinite(Number(normalizeNumber(value)))) {
    alert('لطفاً یک عدد معتبر وارد کن.');
    return;
  }
  const correct = isCorrect(question, value);
  session.results.push({ correct });
  session.locked = true;
  session.current = { answer: value, correct };
  if (session.type === 'practice' && !isAnswered(question)) {
    state.answers[question.id] = { correct, category: question.category, lesson: question.lesson };
    if (correct) state.xp += 10;
    const lesson = lessons[question.lesson];
    if (lesson.q.every(isAnswered) && !state.completionRewards.includes(question.lesson)) {
      state.completionRewards.push(question.lesson);
      state.completed = [...new Set([...state.completed, question.lesson])];
      state.xp += 50;
    }
    saveState();
  } else if (session.type === 'daily' && !state.daily[today()]) {
    state.daily[today()] = { id: question.id, answer: value, correct };
    if (correct) state.xp += 30;
    saveState();
  }
  render();
}

function nextPracticeQuestion() {
  session.index += 1;
  session.locked = false;
  session.selected = null;
  session.current = null;
  if (session.index >= session.questions.length) session.done = true;
  render();
  window.scrollTo(0, 0);
}

function selectPracticeOption(index) { session.selected = index; render(); }

function quizPage() {
  if (session.done) {
    const correct = session.results.filter((result) => result.correct).length;
    const total = session.questions.length;
    const title = session.type === 'daily' ? 'چالش امروز ثبت شد!' : 'تمرین به پایان رسید!';
    return `<div class="quiz panel" style="text-align:center"><div class="icon" style="margin:auto">✓</div><h1>${title}</h1><p>${fa(correct)} پاسخ درست از ${fa(total)} سؤال · ${fa(percent(correct, total))}٪</p><button class="btn" onclick="openLesson(${lessonIndex})">بازگشت به درس</button> <button class="btn secondary" onclick="go('home')">داشبورد</button></div>`;
  }
  const question = session.questions[session.index];
  const current = session.current;
  const exit = session.type === 'daily' ? "go('daily')" : `openLesson(${lessonIndex})`;
  const category = session.category ? CATEGORIES[session.category].title : 'چالش روزانه';
  const choices = question.options ? `<div class="options">${question.options.map((option, index) => {
    const isRight = session.locked && Number(question.answer) === index;
    const isWrong = session.locked && Number(current.answer) === index && !current.correct;
    const selected = !session.locked && session.selected === index;
    return `<button class="option ${isRight ? 'correct' : isWrong ? 'wrong' : selected ? 'selected' : ''}" ${session.locked ? 'disabled' : ''} onclick="selectPracticeOption(${index})">${fa(index + 1)}. &nbsp; ${mathText(option)}</button>`;
  }).join('')}</div>` : `<label class="sr-only" for="numeric-answer">پاسخ عددی</label><input id="numeric-answer" dir="ltr" inputmode="decimal" autocomplete="off" placeholder="پاسخ عددی را وارد کن" value="${current ? escapeHtml(current.answer) : ''}" ${session.locked ? 'disabled' : ''} onkeydown="if(event.key==='Enter')submitPracticeAnswer()">`;
  const feedback = session.locked ? `<div class="feedback ${current.correct ? '' : 'bad'}" role="status"><strong>${current.correct ? 'آفرین! پاسخ درسته ✓' : `پاسخ درست: ${expectedAnswer(question)}`}</strong><p>${mathText(question.explain)}</p><small>XP تمرین فقط برای نخستین پاسخ هر سؤال محاسبه می‌شود.</small></div><button class="btn" onclick="${session.type === 'daily' ? "go('daily')" : 'nextPracticeQuestion()'}">${session.type === 'daily' ? 'بازگشت به چالش' : session.index === session.questions.length - 1 ? 'دیدن نتیجه' : 'سؤال بعدی ←'}</button>` : `<button class="btn" style="margin-top:18px" onclick="submitPracticeAnswer()">بررسی پاسخ</button>`;
  return `<div class="quiz"><button class="back" onclick="${exit}">→ خروج از تمرین</button><div class="panel"><div class="question-meta"><span>${session.type === 'daily' ? 'چالش امروز' : `${CATEGORIES[session.category].title} · سؤال ${fa(session.index + 1)} از ${fa(session.questions.length)}`}</span><span class="tag">${question.difficulty} · ${lessons[question.lesson].title}</span></div><div class="track"><div class="fill" style="width:${percent(session.index + 1, session.questions.length)}%"></div></div><span class="inline-note">${category}</span><h2 class="question">${mathText(question.p)}</h2>${choices}${feedback}</div></div>`;
}

function dailyQuestion() {
  const date = new Date();
  const dayNumber = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
  return allQuestions[((dayNumber % allQuestions.length) + allQuestions.length) % allQuestions.length];
}

function dailyPage() {
  const done = state.daily[today()];
  return `<div class="quiz"><div class="eyebrow">✦ یک سؤال، هر روز</div><h1 class="title">چالش روزانه</h1><p class="subtitle">با یک چالش کوتاه، یادگیری امروزت رو شروع کن.</p><div class="panel daily"><div style="font-size:32px" aria-hidden="true">✧</div><h2>${done ? (done.correct ? 'آفرین! چالش امروز رو حل کردی.' : 'پاسخ چالش امروز ثبت شد.') : 'چالش امروز منتظرته!'}</h2><p>${done ? (done.correct ? '۳۰ امتیاز چالش رو گرفتی.' : 'امروز پاسخ نادرست بود؛ فردا یک فرصت تازه داری.') : 'یک سؤال از فصل اول؛ با پاسخ درست ۳۰ XP جایزه بگیر.'}</p><p class="notice">هر روز یک تلاش · سؤال روزانه با روز قبل متفاوت است · تاریخ دستگاه مبناست</p><button class="btn" onclick="startDaily()">${done ? 'مشاهدهٔ پاسخ چالش' : 'شروع چالش ←'}</button></div></div>`;
}

function startDaily() {
  const question = dailyQuestion();
  const existing = state.daily[today()];
  session = { type: 'daily', category: null, questions: [question], index: 0, results: [], selected: existing?.answer ?? null, locked: Boolean(existing), current: existing ? { answer: existing.answer, correct: existing.correct } : null };
  page = 'practice';
  render();
}

function examPage() {
  return `<div class="quiz"><div class="eyebrow">✦ خودت رو محک بزن</div><h1 class="title">آزمون فصل اول</h1><p class="subtitle">سؤال‌های تصادفی از هر چهار درس با پاسخ‌نامه و کارنامه.</p><div class="panel"><h2>تنظیمات آزمون</h2><p class="notice">سطح سؤال‌ها ترکیبی است. آزمون شامل هر دو دستهٔ مفهومی و محاسباتی می‌شود.</p><label for="exam-count">تعداد سؤال</label><select id="exam-count" style="margin:8px 0 18px"><option value="20">۲۰ سؤال</option><option value="10">۱۰ سؤال</option><option value="40">۴۰ سؤال</option><option value="80">۸۰ سؤال</option></select><label for="exam-minutes">زمان آزمون</label><select id="exam-minutes" style="margin:8px 0 20px"><option value="30">۳۰ دقیقه</option><option value="15">۱۵ دقیقه</option><option value="60">۶۰ دقیقه</option><option value="0">بدون محدودیت زمانی</option></select><button class="btn" onclick="startExam()">شروع آزمون ←</button></div></div>`;
}

function createExam(size, minutes, bank) {
  const pools = lessons.map((lesson) => shuffle(lesson.q.filter((question) => !bank || question.category === bank)));
  const questions = [];
  let round = 0;
  while (questions.length < size) {
    let added = false;
    for (let index = 0; index < pools.length && questions.length < size; index += 1) {
      if (pools[index].length) {
        questions.push(pools[index].pop());
        added = true;
      }
    }
    if (!added) break;
    round += 1;
    if (round > allQuestions.length) break;
  }
  if (questions.length < size) {
    const seen = new Set(questions.map((question) => question.id));
    questions.push(...shuffle(allQuestions.filter((question) => !bank || question.category === bank).filter((question) => !seen.has(question.id))).slice(0, size - questions.length));
  }
  return { type: 'exam', questions: shuffle(questions), index: 0, answers: {}, end: minutes ? Date.now() + minutes * 60000 : null };
}

function startExam() {
  session = createExam(Number($('#exam-count').value), Number($('#exam-minutes').value), null);
  page = 'examrun';
  render();
  if (session.end) timer = setInterval(() => {
    if (!session || Date.now() >= session.end) { finishExam(); return; }
    const timerNode = $('#exam-timer');
    if (timerNode) timerNode.textContent = timeLeft();
  }, 1000);
}

function startLessonExam(index) {
  lessonIndex = index;
  const questionCount = lessons[index].q.length;
  session = { type: 'exam', questions: shuffle(lessons[index].q), index: 0, answers: {}, end: null, lessonOnly: true };
  session.questions = session.questions.slice(0, Math.min(20, questionCount));
  page = 'examrun';
  render();
}

function timeLeft() {
  const seconds = Math.max(0, Math.ceil((session.end - Date.now()) / 1000));
  return fa(`${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`);
}

function examRunPage() {
  const question = session.questions[session.index];
  const value = session.answers[question.id];
  const choices = question.options ? `<div class="options">${question.options.map((option, index) => `<button class="option ${value === index ? 'selected' : ''}" onclick="selectExamOption(${index})">${fa(index + 1)}. &nbsp; ${mathText(option)}</button>`).join('')}</div>` : `<label class="sr-only" for="exam-numeric">پاسخ عددی</label><input id="exam-numeric" dir="ltr" inputmode="decimal" placeholder="پاسخ عددی" value="${escapeHtml(value ?? '')}" oninput="session.answers['${question.id}']=this.value">`;
  return `<div class="quiz"><div class="panel"><div class="row"><span>${session.lessonOnly ? `${lessons[lessonIndex].title} · ` : ''}آزمون · سؤال ${fa(session.index + 1)} از ${fa(session.questions.length)}</span><span id="exam-timer" class="math-run">${session.end ? timeLeft() : 'بدون زمان'}</span></div><div class="track"><div class="fill" style="width:${percent(session.index + 1, session.questions.length)}%"></div></div><div class="question-meta"><span class="tag">${question.category === 'concept' ? CATEGORIES.concept.title : CATEGORIES.problem.title}</span><span class="tag">${question.difficulty} · ${lessons[question.lesson].title}</span></div><h2 class="question">${mathText(question.p)}</h2>${choices}<div class="controls" style="margin-top:22px"><button class="btn secondary" ${session.index === 0 ? 'disabled' : ''} onclick="moveExam(-1)">→ قبلی</button><button class="btn secondary" ${session.index === session.questions.length - 1 ? 'disabled' : ''} onclick="moveExam(1)">بعدی ←</button><button class="btn" onclick="confirmExam()">تحویل آزمون</button><span class="notice">${fa(Object.values(session.answers).filter((answer) => String(answer).trim() !== '').length)} پاسخ ثبت‌شده</span></div></div></div>`;
}

function selectExamOption(index) { session.answers[session.questions[session.index].id] = index; render(); }
function moveExam(offset) { session.index = Math.max(0, Math.min(session.questions.length - 1, session.index + offset)); render(); }
function confirmExam() { if (confirm('آزمون تحویل داده شود؟ سؤال‌های بدون پاسخ نادرست محاسبه می‌شوند.')) finishExam(); }

function finishExam() {
  if (!session || session.type !== 'exam') return;
  clearInterval(timer);
  timer = null;
  const correct = session.questions.filter((question) => session.answers[question.id] !== undefined && String(session.answers[question.id]).trim() !== '' && isCorrect(question, session.answers[question.id])).length;
  session.score = correct;
  session.finishedAt = today();
  state.exams.push({ date: today(), correct, total: session.questions.length, lesson: session.lessonOnly ? lessonIndex : null });
  saveState();
  page = 'examresult';
  render();
}

function examResultPage() {
  const correct = session.score;
  const total = session.questions.length;
  const score = percent(correct, total);
  return `<div class="quiz"><h1 class="title">نتیجهٔ آزمون</h1><p class="subtitle">${score >= 80 ? 'عالی بود! تسلط خوبی داری.' : score >= 50 ? 'خوب پیش می‌ری؛ بخش‌های دشوار رو مرور کن.' : 'شروع خوبیه؛ درس‌ها رو مرور کن و دوباره امتحان کن.'}</p><div class="stats">${stat('✓','درست',`${fa(correct)} از ${fa(total)}`)}${stat('◔','درصد',`${fa(score)}٪`)}${stat('✕','نادرست یا بی‌پاسخ',fa(total - correct))}${stat('✦','دسته‌ها', 'مفهومی + محاسباتی')}</div><h2>بررسی پاسخ‌ها</h2>${session.questions.map((question, index) => {
    const answer = session.answers[question.id];
    const isRight = answer !== undefined && String(answer).trim() !== '' && isCorrect(question, answer);
    return `<article class="review"><strong>${fa(index + 1)}. ${mathText(question.p)}</strong><p style="color:${isRight ? '#76dcb7' : '#ff9bad'}">پاسخ شما: ${displayedAnswer(question, answer)} ${isRight ? '✓' : '✕'}</p><p>پاسخ درست: ${expectedAnswer(question)}</p><p class="notice">${mathText(question.explain)}</p></article>`;
  }).join('')}<button class="btn" onclick="go('exam')">آزمون جدید</button> <button class="btn secondary" onclick="go('home')">داشبورد</button></div>`;
}

function achievementsPage() {
  const badges = [
    ['✦','اولین قدم','پاسخ به اولین سؤال',aggregateAttempted() > 0],
    ['✓','ده پاسخ درست','۱۰ پاسخ درست در تمرین',aggregateCorrect() >= 10],
    ['♜','درس کامل','پاسخ به تمام سؤال‌های یک درس',completedLessons() > 0],
    ['☀','چالش‌پذیر','حل یک چالش روزانه',Object.values(state.daily).some((item) => item.correct)],
    ['★','صد امتیازی','کسب ۱۰۰ XP',state.xp >= 100],
    ['♛','فاتح فصل','تکمیل هر چهار درس',completedLessons() === lessons.length]
  ];
  return `<h1 class="title">دستاوردهای من</h1><p class="subtitle">هر قدم کوچیک، یک موفقیت بزرگه.</p><div class="stats">${stat('✦','امتیاز کل',`${fa(state.xp)} XP`)}${stat('♧','سطح فعلی',fa(userLevel()))}${stat('✓','درس‌های کامل',`${fa(completedLessons())} از ${fa(lessons.length)}`)}${stat('★','نشان‌های کسب‌شده',fa(badges.filter((badge) => badge[3]).length))}</div><div class="badges">${badges.map((badge) => `<div class="panel badge ${badge[3] ? '' : 'locked'}"><div style="font-size:30px">${badge[0]}</div><h3>${badge[1]}</h3><p class="notice">${badge[2]}</p><span class="tag">${badge[3] ? 'کسب شد' : 'هنوز قفل است'}</span></div>`).join('')}</div>`;
}

function statsPage() {
  const best = state.exams.length ? Math.max(...state.exams.map((exam) => percent(exam.correct, exam.total))) : null;
  const rows = lessons.map((lesson, index) => `<article class="lesson-row"><div class="row"><h3>${fa(index + 1)}. ${lesson.title}</h3><span>${fa(lesson.q.filter(isAnswered).length)} / ${fa(lesson.q.length)} سؤال</span></div><div class="track"><div class="fill" style="width:${percent(lesson.q.filter(isAnswered).length, lesson.q.length)}%"></div></div><div class="category-grid">${Object.keys(CATEGORIES).map((category) => {
    const stats = categoryStatistics(index, category);
    return `<div class="mini-stat"><small>${CATEGORIES[category].title}</small><strong>${fa(stats.attempted)} / ${fa(stats.questions.length)} پاسخ · دقت ${fa(stats.accuracy)}٪</strong><small>امتیاز تمرین: ${fa(stats.xp)} XP</small><div class="track"><div class="fill" style="width:${stats.progress}%"></div></div></div>`;
  }).join('')}</div></article>`).join('');
  return `<h1 class="title">آمار و پیشرفت من</h1><p class="subtitle">پیشرفت و دقت برای هر دسته و هر درس جداگانه محاسبه می‌شود.</p><div class="stats">${stat('▤','سؤال پاسخ‌داده‌شده',fa(aggregateAttempted()))}${stat('✓','درست در تلاش اول',fa(aggregateCorrect()))}${stat('✕','نادرست در تلاش اول',fa(aggregateAttempted() - aggregateCorrect()))}${stat('◔','دقت تلاش اول',`${fa(percent(aggregateCorrect(), aggregateAttempted()))}٪`)}</div><div class="panel"><h2>پیشرفت چهار درس و هشت بانک</h2><div class="lesson-list">${rows}</div><p class="notice">پیشرفت و دقت بر اساس نخستین پاسخ هر سؤال است. XP تمرین برای پاسخ درست نخستین بار ۱۰ است؛ آزمون و چالش امتیازهای جداگانه دارند.</p></div><div class="panel"><h2>رکوردهای شخصی</h2><p>بهترین درصد آزمون: ${best === null ? 'هنوز آزمونی ثبت نشده' : `${fa(best)}٪`}</p><p>تعداد آزمون‌های پایان‌یافته: ${fa(state.exams.length)}</p><p>چالش‌های حل‌شده: ${fa(Object.values(state.daily).filter((item) => item.correct).length)}</p><p class="notice">پیشرفت فقط روی همین دستگاه ذخیره می‌شود و رتبه‌بندی سراسری وجود ندارد.</p><button class="btn secondary" onclick="resetProgress()">پاک کردن پیشرفت</button></div>`;
}

function resetProgress() {
  if (!confirm('همهٔ پیشرفت، امتیازها و رکوردها پاک شوند؟ این کار قابل بازگشت نیست.')) return;
  const name = state.name;
  state = freshState();
  state.name = name;
  saveState();
  render();
}

function aboutPage() {
  return `<h1 class="title">دربارهٔ دهم ریاضی سعدی</h1><p class="subtitle">یاد بگیر، تمرین کن، پیشرفت کن.</p><section class="panel prose"><h2>یادگیری برای همه، بدون ثبت‌نام</h2><p>این محیط تمرینی برای مرور فصل اول ریاضی دهم طراحی شده است. چهار درس، درس‌نامه، پرسش‌های مفهومی و محاسباتی مستقل، آزمون، چالش روزانه، امتیاز تجربه و دستاوردها در دسترس‌اند.</p><p>نام نمایشی، پاسخ‌های نخستین تلاش و آمار مهمان فقط در <bdi dir="ltr">localStorage</bdi> مرورگر همین دستگاه ذخیره می‌شوند؛ با پاک کردن داده‌های مرورگر ممکن است از بین بروند و به دستگاه دیگری منتقل نمی‌شوند. هیچ ایمیل، شمارهٔ تلفن یا حساب کاربری لازم نیست.</p><p>فرمول‌های ریاضی با KaTeX و در جهت چپ‌به‌راست نمایش داده می‌شوند؛ متن فارسی راست‌به‌چپ است. این محتوا جایگزین کتاب درسی و راهنمایی معلم نیست.</p><hr><h2>دربارهٔ سازنده</h2><p>Created by <bdi dir="ltr">Arman Es</bdi><br>طراحی و توسعه: آرمان</p><button class="btn secondary" onclick="go('stats')">مشاهدهٔ آمار و تنظیمات</button></section>`;
}

function render() {
  const pages = {
    home: homePage,
    lessons: lessonListPage,
    lesson: lessonPage,
    practice: quizPage,
    daily: dailyPage,
    exam: examPage,
    examrun: examRunPage,
    examresult: examResultPage,
    achievements: achievementsPage,
    stats: statsPage,
    about: aboutPage
  };
  root.innerHTML = shell((pages[page] || homePage)());
}

render();
