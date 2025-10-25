// app.js for Create Image project
const el = (id) => document.getElementById(id);
const log = el('log');
const form = el('gen-form');
const inputPrompt = el('prompt');
const selRatio = el('ratio');
const selSize = el('size');
const inputSteps = el('steps');
const btnGen = el('generate');
const promptHelp = el('prompt-help');
const promptModal = document.getElementById('prompt-modal');
const modalClose = el('modal-close');
const toastEl = el('toast');

// Configure backend base URL (set window.BACKEND_URL in HTML if needed)
const BACKEND_URL = window.BACKEND_URL || '';

const PRESETS = {
  '1:1': ['512x512','768x768','1024x1024','1536x1536'],
  '16:9': ['1280x720','1920x1080','2560x1440','3840x2160'],
  '9:16': ['896x1536','720x1280','1080x1920','1440x2560','2160x3840'],
  '4:3': ['800x600','1024x768','1600x1200'],
  '3:4': ['600x800','768x1024','1200x1600']
};

const PROMPT_LIBRARY = [
  { title: 'Portrait', prompt: 'a cinematic portrait, soft rim light, bokeh background, 85mm' },
  { title: 'Travel', prompt: 'a misty mountain temple at sunrise, golden hour, film grain' },
  { title: 'Product', prompt: 'a perfume bottle on marble with water droplets, studio lighting' },
  { title: 'Landscape', prompt: 'futuristic city under neon rain, cyberpunk, volumetric fog' },
  { title: 'Food', prompt: 'a rustic sourdough loaf with butter, cozy, warm lighting' },
  { title: 'Minimal', prompt: 'abstract geometric shapes with gradients, neo-minimal, clean' },
];

function println(msg){
  log.textContent += (msg + "\n");
}

function showToast(msg){
  if (!toastEl) return;
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  setTimeout(()=> toastEl.classList.remove('show'), 1800);
}

function setBusy(b){
  btnGen.disabled = b;
  btnGen.setAttribute('aria-busy', b? 'true':'false');
  btnGen.textContent = b ? 'Generating…' : 'Generate';
  document.body.classList.toggle('generating', !!b);
}

function populateSizes(){
  const ratio = selRatio.value || '9:16';
  const sizes = PRESETS[ratio] || PRESETS['9:16'];
  selSize.innerHTML = '';
  sizes.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s; opt.textContent = s;
    selSize.appendChild(opt);
  });
}

selRatio?.addEventListener('change', populateSizes);
// Initialize sizes on load
populateSizes();

async function callGenerate(prompt, image_size, steps){
  const base = BACKEND_URL || window.location.origin;
  const endpoint = `${base.replace(/\/$/, '')}/api/generate`;
  const r = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, image_size, num_inference_steps: steps })
  });
  if (!r.ok) { throw new Error(await r.text()); }
  return r.json();
}

function base64ToBlob(b64, mime='image/png'){
  const byteChars = atob(b64);
  const byteNumbers = new Array(byteChars.length);
  for (let i=0; i<byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], {type: mime});
}

async function fetchImageBlob(url){
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const type = res.headers.get('Content-Type') || 'image/png';
  const blob = await res.blob();
  return { blob, type };
}

function downloadBlob(blob, filename='generated.png'){
  const blobUrl = URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href = blobUrl;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=> URL.revokeObjectURL(blobUrl), 2000);
}




function openModal(){ promptModal?.classList.remove('hidden'); }
function closeModal(){ promptModal?.classList.add('hidden'); }
function populatePromptLibrary(){
  const wrap = document.getElementById('modal-prompts');
  if (!wrap) return;
  wrap.innerHTML = '';
  PROMPT_LIBRARY.forEach(item => {
    const tile = document.createElement('div'); tile.className='prompt-tile';
    const h4 = document.createElement('h4'); h4.textContent = item.title;
    const p = document.createElement('p'); p.textContent = item.prompt;
    const btn = document.createElement('button'); btn.className='button small'; btn.textContent='Use';
    btn.addEventListener('click', ()=> { inputPrompt.value = item.prompt; closeModal(); inputPrompt.focus(); });
    tile.appendChild(h4); tile.appendChild(p); tile.appendChild(btn);
    wrap.appendChild(tile);
  });
}

promptHelp?.addEventListener('click', ()=> { populatePromptLibrary(); openModal(); });
modalClose?.addEventListener('click', ()=> closeModal());
promptModal?.addEventListener('click', (e)=> { if (e.target === promptModal) closeModal(); });

form?.addEventListener('submit', async (e)=>{
  e.preventDefault();
  const prompt = (inputPrompt.value || '').trim();
  const size = selSize.value || '1024x1024';
  const steps = Number(inputSteps.value || 20);
  if (!prompt) return alert('Please enter a prompt.');

  try{
    setBusy(true);
    println('Calling image generation API...');
    const raw = await callGenerate(prompt, size, steps);

    // Flexible parse: try common fields
    const imageObj = raw?.image || raw?.images?.[0] || raw?.data?.[0] || raw;
    const url = imageObj?.url || raw?.image_url || undefined;
    const b64 = imageObj?.b64_json || raw?.image_base64 || undefined;

    if (url){
      const { blob } = await fetchImageBlob(url);
      downloadBlob(blob);
      println('Image downloaded from URL.');
      showToast('✨ Image generated successfully');
    }else if (b64){
      const blob = base64ToBlob(b64, 'image/png');
      downloadBlob(blob);
      println('Image downloaded from base64 data.');
      showToast('✨ Image generated successfully');
    }else{
      println('No URL or base64 found in response.');
      console.log('Response', raw);
      alert('API did not return a valid image.');
    }
  }catch(err){
    console.error(err);
    println('Error generating image: ' + (err?.message || String(err)));
    alert('There was an error generating the image.');
  }finally{
    setBusy(false);
  }
});