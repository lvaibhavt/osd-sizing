const form = document.querySelector('#sizer-form');
const poolsElement = document.querySelector('#pools');
const poolTemplate = document.querySelector('#pool-template');
const multiPool = document.querySelector('#multi-pool');
const addPoolButton = document.querySelector('#add-pool');
let catalog;

const fmt = (value, currency) => new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);

async function loadCatalog() {
  catalog = await (await fetch('/api/catalog')).json();
  addPool();
  form.hours_per_month = catalog.hours_per_month;
  document.querySelector('#region').textContent = catalog.region_label;
  form.requestSubmit();
}

function addPool() {
  const fragment = poolTemplate.content.cloneNode(true);
  const pool = fragment.querySelector('.pool-card');
  const shapeSelect = fragment.querySelector('.shape');
  Object.entries(catalog.shapes).forEach(([key, shape]) => {
    const option = new Option(`${shape.label} (${key})`, key);
    shapeSelect.add(option);
  });
  pool.querySelector('[name="hours_per_month"]').value = catalog.hours_per_month;
  pool.querySelector('.pool-name').dataset.autoName = 'true';
  poolsElement.append(fragment);
  refreshPools();
}

function refreshPools() {
  const pools = [...poolsElement.querySelectorAll('.pool-card')];
  pools.forEach((pool, index) => {
    const number = index + 1;
    pool.querySelector('.pool-number').textContent = `Pool ${number}`;
    const name = pool.querySelector('.pool-name');
    if (!name.value || name.dataset.autoName === 'true') { name.value = `Pool ${number}`; name.dataset.autoName = 'true'; }
    pool.querySelector('.remove-pool').hidden = pools.length === 1;
  });
}

multiPool.addEventListener('change', () => {
  addPoolButton.hidden = !multiPool.checked;
  if (!multiPool.checked) {
    [...poolsElement.querySelectorAll('.pool-card')].slice(1).forEach(pool => pool.remove());
    refreshPools();
  }
});

addPoolButton.addEventListener('click', addPool);
poolsElement.addEventListener('click', event => {
  if (event.target.matches('.remove-pool')) { event.target.closest('.pool-card').remove(); refreshPools(); }
});
poolsElement.addEventListener('input', event => {
  if (event.target.matches('.pool-name')) event.target.dataset.autoName = 'false';
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  const pools = [...poolsElement.querySelectorAll('.pool-card')].map(pool => {
    const values = Object.fromEntries([...pool.querySelectorAll('input[name], select[name]')].map(field => [field.name, field.value]));
    ['desktops', 'ocpus', 'memory_gb', 'boot_gb', 'data_gb', 'vpus', 'hours_per_month'].forEach(key => values[key] = Number(values[key]));
    values.name = pool.querySelector('.pool-name').value.trim() || 'Untitled pool';
    return values;
  });
  const response = await fetch('/api/estimate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pools }) });
  const result = await response.json();
  if (!response.ok) { document.querySelector('#notice').textContent = result.error; return; }
  const { summary } = result;
  document.querySelector('#monthly').textContent = `${fmt(summary.monthly, result.currency)} / month`;
  document.querySelector('#annual').textContent = fmt(summary.annual, result.currency);
  document.querySelector('#three-year').textContent = fmt(summary.three_year, result.currency);
  document.querySelector('#region').textContent = result.region_label;
  document.querySelector('#pool-summary').innerHTML = result.pools.map(pool => `<div class="pool-result"><strong>${pool.name}</strong><span>${pool.desktops} desktop(s) · ${fmt(pool.consumption, result.currency)} consumption / month</span></div>`).join('');
  document.querySelector('#lines').innerHTML = result.line_items.map(line => `<div class="line"><div><strong>${line.name}</strong><small>${line.detail}</small></div><b>${fmt(line.monthly, result.currency)}</b></div>`).join('');
  document.querySelector('#notice').textContent = result.configured ? 'Uses the price catalog in this project.' : 'Action needed: add the regional OCPU, memory, and block-volume prices in price_catalog.json before using this estimate.';
});

loadCatalog().catch(() => document.querySelector('#notice').textContent = 'Unable to load the price catalog.');
