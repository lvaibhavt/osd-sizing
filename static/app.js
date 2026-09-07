const form = document.querySelector('#sizer-form');
const shapeSelect = document.querySelector('#shape');
let catalog;

const fmt = (value, currency) => new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);

async function loadCatalog() {
  catalog = await (await fetch('/api/catalog')).json();
  Object.entries(catalog.shapes).forEach(([key, shape]) => {
    const option = new Option(`${shape.label} (${key})`, key);
    shapeSelect.add(option);
  });
  form.hours_per_month.value = catalog.hours_per_month;
  document.querySelector('#region').textContent = catalog.region_label;
  form.requestSubmit();
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const values = Object.fromEntries(new FormData(form));
  ['desktops', 'ocpus', 'memory_gb', 'boot_gb', 'data_gb', 'vpus', 'hours_per_month'].forEach(key => values[key] = Number(values[key]));
  const response = await fetch('/api/estimate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) });
  const result = await response.json();
  if (!response.ok) { document.querySelector('#notice').textContent = result.error; return; }
  const { summary } = result;
  document.querySelector('#monthly').textContent = `${fmt(summary.monthly, result.currency)} / month`;
  document.querySelector('#annual').textContent = fmt(summary.annual, result.currency);
  document.querySelector('#three-year').textContent = fmt(summary.three_year, result.currency);
  document.querySelector('#region').textContent = result.region_label;
  document.querySelector('#lines').innerHTML = result.line_items.map(line => `<div class="line"><div><strong>${line.name}</strong><small>${line.detail}</small></div><b>${fmt(line.monthly, result.currency)}</b></div>`).join('');
  document.querySelector('#notice').textContent = result.configured ? 'Uses the price catalog in this project.' : 'Action needed: add the regional OCPU, memory, and block-volume prices in price_catalog.json before using this estimate.';
});

loadCatalog().catch(() => document.querySelector('#notice').textContent = 'Unable to load the price catalog.');
