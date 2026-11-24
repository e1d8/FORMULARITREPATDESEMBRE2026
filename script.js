'use strict';

const BLOCK_COUNT = 30;
const MAX_ATTEMPTS = 99;
const SCORE_SUMMARIES = new Map([
  [0, '0 punts'],
  [10, 'Zona · 10 punts'],
  [25, 'Top · 25 punts']
]);
const VISIT_KEY = 'trepat_open_2026_visited';

const form = document.getElementById('resultats');
const formControls = document.getElementById('form-controls');
const dorsalInput = document.getElementById('dorsal');
const anonymousInput = document.getElementById('anonimo');
const personalFields = document.getElementById('personal-fields');
const nameInput = document.getElementById('nombre');
const genderGroup = document.getElementById('gender-group');
const genderInputs = [...genderGroup.querySelectorAll('input')];
const blockGrid = document.getElementById('block-grid');
const blockTemplate = document.getElementById('block-template');
const totalOutput = document.getElementById('total');
const saveButton = document.getElementById('guardar');
const saveError = document.getElementById('save-error');
const saveStatus = document.getElementById('save-status');
const returnNotice = document.getElementById('return-notice');
const formLinks = [document.getElementById('registration-nav'), document.getElementById('start-link')];

let sending = false;
let failNextSave = new URLSearchParams(window.location.search).get('simulacio') === 'error';
let openHelpButton = null;

function initMarquee() {
  const marquee = document.getElementById('marquee');
  const toggle = document.getElementById('marquee-toggle');
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');

  function setPaused(paused) {
    marquee.classList.toggle('is-paused', paused);
    toggle.setAttribute('aria-label', paused ? 'Reprén l’animació' : 'Pausa l’animació');
  }

  setPaused(motionPreference.matches);
  toggle.hidden = false;
  toggle.addEventListener('click', () => setPaused(!marquee.classList.contains('is-paused')));
  motionPreference.addEventListener('change', event => setPaused(event.matches));
}

function showReturnNotice() {
  try {
    returnNotice.hidden = localStorage.getItem(VISIT_KEY) !== '1';
    localStorage.setItem(VISIT_KEY, '1');
  } catch {
    // El formulari també funciona quan el navegador restringeix l’emmagatzematge.
  }
}

function setHelp(button, open) {
  const help = document.getElementById(button.getAttribute('aria-controls'));
  button.setAttribute('aria-expanded', String(open));
  help.hidden = !open;
  openHelpButton = open ? button : null;
}

function closeHelp() {
  if (openHelpButton) setHelp(openHelpButton, false);
}

for (const button of form.querySelectorAll('.help-toggle')) {
  button.addEventListener('click', () => {
    const open = button !== openHelpButton;
    closeHelp();
    if (open) setHelp(button, true);
  });
}

document.addEventListener('click', event => {
  if (!event.target.closest('.help-toggle, .field-help')) closeHelp();
});

document.addEventListener('keydown', event => {
  if (event.key !== 'Escape' || !openHelpButton) return;
  const button = openHelpButton;
  closeHelp();
  button.focus();
});

function cleanDorsal(value) {
  return value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

function setFieldError(field, errorId, message = '') {
  const error = document.getElementById(errorId);
  if (message) field.setAttribute('aria-invalid', 'true');
  else field.removeAttribute('aria-invalid');
  error.hidden = !message;
  error.textContent = message;
}

function normalizeDorsal() {
  const { value, selectionStart, selectionEnd, selectionDirection, maxLength } = dorsalInput;
  const normalized = cleanDorsal(value).slice(0, maxLength);
  if (normalized !== value) {
    dorsalInput.value = normalized;
    dorsalInput.setSelectionRange(
      cleanDorsal(value.slice(0, selectionStart)).length,
      cleanDorsal(value.slice(0, selectionEnd)).length,
      selectionDirection
    );
  }
  setFieldError(dorsalInput, 'dorsal-error');
}

dorsalInput.addEventListener('input', event => {
  if (!event.isComposing) normalizeDorsal();
});
dorsalInput.addEventListener('compositionend', normalizeDorsal);
dorsalInput.addEventListener('paste', event => {
  if (!event.clipboardData) return;
  event.preventDefault();
  const { value, selectionStart, selectionEnd, maxLength } = dorsalInput;
  const available = maxLength - value.length + (selectionEnd - selectionStart);
  const text = cleanDorsal(event.clipboardData.getData('text')).slice(0, available);
  dorsalInput.setRangeText(text, selectionStart, selectionEnd, 'end');
  normalizeDorsal();
});

function syncAnonymousMode() {
  const isAnonymous = anonymousInput.checked;
  personalFields.hidden = isAnonymous;
  personalFields.disabled = isAnonymous;
  document.getElementById('anonymous-state').textContent = isAnonymous ? 'Activat' : 'Desactivat';
  closeHelp();
  setFieldError(nameInput, 'name-error');
  setFieldError(genderGroup, 'gender-error');
}

anonymousInput.addEventListener('change', syncAnonymousMode);
nameInput.addEventListener('input', () => setFieldError(nameInput, 'name-error'));
genderGroup.addEventListener('change', () => setFieldError(genderGroup, 'gender-error'));

function createCounter(block, index) {
  const input = block.querySelector('.attempt-input');
  const label = block.querySelector('.attempt-label');
  const [decrease, increase] = block.querySelectorAll('.counter-button');
  input.id = `intentos${index}`;
  input.name = input.id;
  label.htmlFor = input.id;
  input.setAttribute('aria-label', `Intents del bloc ${index}`);
  decrease.setAttribute('aria-label', `Redueix els intents del bloc ${index}`);
  increase.setAttribute('aria-label', `Augmenta els intents del bloc ${index}`);

  let previousValue = '0';

  function refresh() {
    const value = Number(input.value);
    previousValue = input.value;
    input.setAttribute('aria-valuenow', String(value));
    decrease.setAttribute('aria-disabled', String(value === 0));
    increase.setAttribute('aria-disabled', String(value === MAX_ATTEMPTS));
  }

  function setValue(value) {
    input.value = String(value);
    refresh();
  }

  function step(delta) {
    const value = Math.max(0, Math.min(MAX_ATTEMPTS, Number(input.value) + delta));
    setValue(value);
  }

  input.addEventListener('beforeinput', event => {
    if (!event.data) return;
    const length = input.value.length - (input.selectionEnd - input.selectionStart) + event.data.length;
    if (!/^[0-9]+$/.test(event.data) || length > 2) event.preventDefault();
  });
  input.addEventListener('input', () => {
    if (!/^[0-9]{0,2}$/.test(input.value)) input.value = previousValue;
    refresh();
  });
  input.addEventListener('paste', event => {
    if (!event.clipboardData) return;
    event.preventDefault();
    const text = event.clipboardData.getData('text');
    const { value, selectionStart, selectionEnd } = input;
    const length = value.length - (selectionEnd - selectionStart) + text.length;
    if (!/^[0-9]{1,2}$/.test(text) || length > 2) return;
    input.setRangeText(text, selectionStart, selectionEnd, 'end');
    refresh();
  });
  input.addEventListener('focus', () => input.select());
  input.addEventListener('blur', () => setValue(Number(input.value)));
  input.addEventListener('keydown', event => {
    if (event.isComposing || !['ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    step(event.key === 'ArrowUp' ? 1 : -1);
  });
  for (const button of [decrease, increase]) {
    button.addEventListener('click', () => {
      if (button.getAttribute('aria-disabled') !== 'true') step(Number(button.dataset.step));
    });
  }

  setValue(0);
  return { input, setValue };
}

function createBlocks() {
  const fragment = document.createDocumentFragment();
  const counters = [];

  for (let index = 1; index <= BLOCK_COUNT; index += 1) {
    const block = blockTemplate.content.firstElementChild.cloneNode(true);
    block.querySelector('.block-title').textContent = `Bloc ${index}`;
    for (const radio of block.querySelectorAll('input[type="radio"]')) {
      radio.name = `bloque${index}`;
    }
    counters.push(createCounter(block, index));
    fragment.append(block);
  }

  blockGrid.append(fragment);
  return counters;
}

function formatPoints(points) {
  return `${points} punts`;
}

blockGrid.addEventListener('change', event => {
  if (event.target.type !== 'radio') return;
  const choices = [...blockGrid.querySelectorAll('input[type="radio"]:checked')];
  const total = choices.reduce((sum, choice) => sum + Number(choice.value), 0);
  totalOutput.value = formatPoints(total);
});

form.addEventListener('keydown', event => {
  if (event.key === 'Enter' && !event.isComposing && event.target.matches('input[type="text"]')) {
    event.preventDefault();
  }
});

function readIdentity() {
  const dorsal = dorsalInput.value.trim();
  if (!/^[A-Za-z0-9]{1,20}$/.test(dorsal)) {
    setFieldError(dorsalInput, 'dorsal-error', 'Introdueix un dorçal d’entre 1 i 20 lletres o números.');
    dorsalInput.focus();
    return null;
  }

  if (anonymousInput.checked) {
    return { dorsal: dorsal.toUpperCase(), anonimo: true, nombre: 'Anònim', genero: 'Altre' };
  }

  const nombre = nameInput.value.trim();
  if (!nombre || nombre.length > nameInput.maxLength) {
    setFieldError(nameInput, 'name-error', 'Introdueix un nom d’entre 1 i 30 caràcters.');
    nameInput.focus();
    return null;
  }

  const genero = genderInputs.find(input => input.checked)?.value;
  if (!genero) {
    setFieldError(genderGroup, 'gender-error', 'Selecciona una opció de gènere.');
    genderInputs[0].focus();
    return null;
  }

  return { dorsal: dorsal.toUpperCase(), anonimo: false, nombre, genero };
}

function readResult(identity) {
  const data = new FormData(form);
  const result = { ...identity, intentos: [], total: 0 };

  counters.forEach(({ input, setValue }, offset) => {
    const key = `bloque${offset + 1}`;
    const score = Number(data.get(key) ?? NaN);
    if (!SCORE_SUMMARIES.has(score)) throw new Error('Selecciona una puntuació vàlida en cada bloc.');
    if (!/^[0-9]{0,2}$/.test(input.value)) throw new Error('Indica entre 0 i 99 intents per bloc.');

    const attempts = Number(input.value);
    setValue(attempts);
    result[key] = score;
    result.intentos.push(attempts);
    result.total += score;
  });

  return result;
}

// El transport rep les dades validades i confirma el document escrit.
async function saveResult(result) {
  await new Promise(resolve => setTimeout(resolve, 650));
  if (failNextSave) {
    failNextSave = false;
    throw new Error('Enviament simulat interromput. Torna-ho a provar amb el mateix dorçal.');
  }

  return {
    id: result.dorsal,
    result: { ...result, updated_at: new Date().toISOString() }
  };
}

function displaySaveError(message) {
  saveError.hidden = !message;
  saveError.textContent = message;
}

function showConfirmation({ id, result }) {
  document.getElementById('resum-dorsal').textContent = id;
  document.getElementById('resum-anonim').textContent = result.anonimo ? 'Sí' : 'No';
  document.getElementById('resum-nom').textContent = result.nombre;
  document.getElementById('resum-genero').textContent = result.genero;
  document.getElementById('resum-total').textContent = formatPoints(result.total);

  const rows = result.intentos.map((attempts, offset) => {
    const index = offset + 1;
    const row = document.createElement('div');
    const label = document.createElement('dt');
    const value = document.createElement('dd');
    const points = document.createElement('span');
    const count = document.createElement('span');
    label.textContent = `Bloc ${index}`;
    points.textContent = SCORE_SUMMARIES.get(result[`bloque${index}`]);
    count.className = 'summary-attempts';
    count.textContent = `${attempts} ${attempts === 1 ? 'intent' : 'intents'}`;
    value.append(points, count);
    row.append(label, value);
    return row;
  });
  document.getElementById('resum-blocs').replaceChildren(...rows);

  form.hidden = true;
  for (const link of formLinks) link.hidden = true;
  document.getElementById('confirmacio').hidden = false;
  const heading = document.getElementById('agraiment');
  heading.focus({ preventScroll: true });
  heading.scrollIntoView({ block: 'start' });
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (sending || form.hidden) return;
  displaySaveError('');

  const identity = readIdentity();
  if (!identity) return;

  let result;
  try {
    result = readResult(identity);
  } catch (error) {
    displaySaveError(error.message);
    return;
  }

  dorsalInput.value = identity.dorsal;
  if (!identity.anonimo) nameInput.value = identity.nombre;
  closeHelp();
  sending = true;
  formControls.disabled = true;
  form.setAttribute('aria-busy', 'true');
  saveButton.textContent = 'Guardant…';
  saveStatus.textContent = 'Guardant els resultats…';

  let receipt;
  let failure;
  try {
    receipt = await saveResult(result);
  } catch (error) {
    failure = error;
  } finally {
    sending = false;
    formControls.disabled = false;
    form.removeAttribute('aria-busy');
    saveButton.textContent = 'Guardar resultats';
    saveStatus.textContent = '';
  }

  if (receipt) {
    showConfirmation(receipt);
  } else {
    displaySaveError(failure?.message || 'No s’han pogut guardar els resultats. Torna-ho a provar.');
    saveButton.focus({ preventScroll: true });
  }
});

form.reset();
const counters = createBlocks();
syncAnonymousMode();
showReturnNotice();
form.hidden = false;
for (const link of formLinks) link.hidden = false;
initMarquee();
