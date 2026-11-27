const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const context = vm.createContext({});
for (const file of ['data.js', 'theory.js', 'problem-bank.js']) {
  vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file });
}
const lessons = JSON.parse(vm.runInContext('JSON.stringify(lessons)', context));
assert.equal(lessons.length, 4, 'Chapter 1 must contain exactly four lessons');
const ids = new Set();
for (const [lessonIndex, lesson] of lessons.entries()) {
  assert.ok(lesson.title && lesson.text && lesson.formula, `Lesson ${lessonIndex + 1} needs lesson text and a formula`);
  assert.ok(lesson.q.length >= 20, `${lesson.title} needs at least 20 questions`);
  for (const category of ['concept', 'problem']) {
    const bank = lesson.q.filter((question) => question.category === category);
    assert.ok(bank.length >= 10, `${lesson.title}: ${category} bank has fewer than 10 questions`);
    for (const question of bank) {
      assert.ok(question.p && question.explain, `${question.id} needs a prompt and explanation`);
      assert.ok(['آسان', 'متوسط', 'سخت'].includes(question.difficulty), `${question.id} has an unknown difficulty`);
      assert.ok(!ids.has(question.id), `Duplicate question id ${question.id}`);
      ids.add(question.id);
      if (question.options) {
        assert.ok(question.options.length >= 2, `${question.id} needs answer choices`);
        assert.ok(Number.isInteger(Number(question.answer)) && Number(question.answer) >= 0 && Number(question.answer) < question.options.length, `${question.id} has an invalid choice key`);
      } else {
        assert.ok(Number.isFinite(Number(question.answer)), `${question.id} has a non-numeric answer in a numeric question`);
      }
    }
  }
}
console.log('Content validation passed:');
lessons.forEach((lesson, index) => {
  const counts = Object.fromEntries(['concept', 'problem'].map((category) => [category, lesson.q.filter((question) => question.category === category).length]));
  console.log(`  Lesson ${index + 1}: ${lesson.q.length} total; ${counts.concept} conceptual; ${counts.problem} computational`);
});
