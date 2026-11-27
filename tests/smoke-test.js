const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const saved = new Map([['saadi-v1', JSON.stringify({ name: 'QA guest', answers: {}, xp: 0, daily: {}, exams: [], completed: [] })]]);
const nodes = new Map();
const root = { innerHTML: '' };
const document = {
  querySelector(selector) {
    if (selector === '#app') return root;
    if (!nodes.has(selector)) nodes.set(selector, { value: '', textContent: '', focus() {} });
    return nodes.get(selector);
  }
};
const context = vm.createContext({
  document,
  window: { scrollTo() {}, katex: { renderToString: (latex, options = {}) => `<span data-math="${String(latex).replaceAll('"', '&quot;')}" data-display="${Boolean(options.displayMode)}">${latex}</span>` } },
  localStorage: { getItem: (key) => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value) },
  alert() {},
  confirm: () => true,
  setInterval: () => 1,
  clearInterval() {},
  console,
  Date,
  Math,
  Number,
  String,
  Object,
  JSON
});
for (const file of ['data.js', 'theory.js', 'problem-bank.js', 'app.js']) {
  vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file });
}
const run = (source) => vm.runInContext(source, context);

assert.match(root.innerHTML, /سلام QA guest/);
run('openLesson(0)');
assert.match(root.innerHTML, /مفاهیم و تعاریف/);
assert.match(root.innerHTML, /مسائل و محاسبات/);
assert.match(root.innerHTML, /dir="ltr"/);

const firstConcept = run('questionsFor(0, "concept")[0]');
run(`session = {type:'practice', category:'concept', questions:[questionsFor(0,'concept')[0]], index:0, results:[], selected:${firstConcept.options ? firstConcept.answer : 'null'}, locked:false, current:null}`);
if (!firstConcept.options) nodes.set('#numeric-answer', { value: String(firstConcept.answer), textContent: '' });
run('submitPracticeAnswer()');
assert.equal(run(`state.answers[${JSON.stringify(firstConcept.id)}].correct`), true);
assert.equal(run('state.xp'), 10);
assert.equal(run('categoryStatistics(0,"concept").attempted'), 1);
assert.equal(run('categoryStatistics(0,"problem").attempted'), 0);

// Revisiting the question must not award first-attempt XP twice.
run(`session = {type:'practice', category:'concept', questions:[questionsFor(0,'concept')[0]], index:0, results:[], selected:${firstConcept.options ? firstConcept.answer : 'null'}, locked:false, current:null}`);
if (!firstConcept.options) nodes.set('#numeric-answer', { value: String(firstConcept.answer), textContent: '' });
run('submitPracticeAnswer()');
assert.equal(run('state.xp'), 10);
assert.equal(run('isCorrect({options:null, answer:"12"}, "۱۲")'), true);
assert.equal(run('isCorrect({options:null, answer:"12"}, "١٢")'), true);

run('session = createExam(80, 0, null)');
assert.equal(run('session.questions.length'), 80);
assert.equal(run('new Set(session.questions.map(q => q.lesson)).size'), 4);
const beforeExamXP = run('state.xp');
run('session.answers = Object.fromEntries(session.questions.map(q => [q.id, q.options ? q.answer : q.answer]))');
run('finishExam()');
assert.equal(run('session.score'), 80);
assert.equal(run('state.exams.length'), 1);
assert.equal(run('state.xp'), beforeExamXP, 'exam scoring must not silently add practice XP');

run('startDaily()');
const daily = run('session.questions[0]');
if (daily.options) run(`session.selected = ${Number(daily.answer)}`);
else nodes.set('#numeric-answer', { value: String(daily.answer), textContent: '' });
run('submitPracticeAnswer()');
assert.ok(run('state.daily[today()]'));
assert.equal(run('state.daily[today()].correct'), true);
assert.equal(run('state.xp'), beforeExamXP + 30);

const persisted = JSON.parse(saved.get('saadi-v1'));
assert.equal(persisted.answers[firstConcept.id].correct, true);
assert.equal(persisted.exams.length, 1);
assert.match(run('onboarding()'), /id="display-name"/);
assert.doesNotMatch(run('onboarding()'), /ریاضی‌دوست|ستاره/);
assert.match(run('onboarding()'), /نام نمایشی دلخواهت رو خودت وارد کن/);
assert.match(fs.readFileSync('style.css', 'utf8'), /@media\(max-width:780px\)/);
assert.match(fs.readFileSync('index.html', 'utf8'), /katex@0\.16\.11/);

for (let i = 0; i < 4; i += 1) {
  run(`openLesson(${i})`);
  assert.match(root.innerHTML, new RegExp(`درس ${'۰۱۲۳۴'[i + 1]}`));
  assert.match(root.innerHTML, /data-math=/);
}
for (const target of ['home', 'lessons', 'daily', 'exam', 'achievements', 'stats', 'about']) {
  run(`go('${target}')`);
  assert.notEqual(root.innerHTML.length, 0, `page ${target} should render`);
}
console.log('Functional smoke tests passed: guest start, all lessons/categories, LTR math, numeric validation, isolated category tracking, first-attempt XP, exam score, daily challenge, localStorage, and navigation.');
