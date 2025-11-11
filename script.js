// -------- CONFIG (replace WA_NUMBER) --------
const WA_NUMBER = "15551234567"; // <<-- REPLACE with your phone number (no +)
// Optional Google Sheet webhook URL (leave empty if not using)
const SHEET_WEBHOOK = ""; // e.g. "https://script.google.com/macros/s/XXXXX/exec"

// -------- Helpers & Cart (persists in localStorage) --------
function loadCart(){
  try {
    const raw = localStorage.getItem('royalplate_cart');
    return raw ? JSON.parse(raw) : [];
  } catch(e){ return []; }
}
function saveCart(cart){ localStorage.setItem('royalplate_cart', JSON.stringify(cart)); updateCartCount(); }
function updateCartCount(){
  const cart = loadCart();
  document.querySelectorAll('#cartCount').forEach(el=>{
    el.textContent = cart.length;
  });
}
function addItemToCart(name, price){
  const cart = loadCart();
  cart.push({name, price: Number(price), qty:1});
  saveCart(cart);
  showToast(`${name} added to cart`);
}
function clearCart(){
  localStorage.removeItem('royalplate_cart');
  updateCartCount();
  renderCart();
}

// small toast
function showToast(msg){
  // quick alert for phone; replace with nicer UI if desired
  if(window.navigator && window.navigator.vibrate) navigator.vibrate(30);
  alert(msg);
}

// attach Add buttons on menu pages
document.addEventListener('DOMContentLoaded', function(){
  updateCartCount();

  document.querySelectorAll('.order-add').forEach(btn=>{
    btn.addEventListener('click', (e)=>{
      const item = btn.closest('.menu-item');
      const name = item.dataset.name;
      const price = item.dataset.price;
      addItemToCart(name, price);
    });
  });

  // if on order page, render cart
  if(document.getElementById('cartArea')) renderCart();

  // update cart count elements (in case multiple)
  document.querySelectorAll('#cartCount').forEach(el=>el.textContent = loadCart().length);
});

// ----- Render cart on order page -----
function renderCart(){
  const cartArea = document.getElementById('cartArea');
  if(!cartArea) return;
  const cart = loadCart();
  if(cart.length === 0){
    cartArea.innerHTML = '<p class="muted">Your cart is empty. Visit the <a href="menu.html">menu</a> to add dishes.</p>';
    return;
  }

  let html = '<div class="cart-list">';
  let total = 0;
  cart.forEach((it, i)=>{
    const itemTotal = (it.price * (it.qty || 1));
    total += itemTotal;
    html += `<div class="cart-item" data-index="${i}">
      <strong>${it.name}</strong> — $${it.price.toFixed(2)} x <input class="qty" type="number" min="1" value="${it.qty||1}" style="width:60px" />
      <button class="btn-outline remove-item" style="margin-left:10px">Remove</button>
      <div class="muted">Item total: $${itemTotal.toFixed(2)}</div>
    </div><hr/>`;
  });
  html += `</div>
    <div style="margin-top:12px"><strong>Total: $${total.toFixed(2)}</strong></div>`;
  cartArea.innerHTML = html;

  // attach handlers
  cartArea.querySelectorAll('.remove-item').forEach(b=>{
    b.addEventListener('click', (e)=>{
      const idx = Number(b.closest('.cart-item').dataset.index);
      const c = loadCart(); c.splice(idx,1); saveCart(c); renderCart();
    });
  });
  cartArea.querySelectorAll('.qty').forEach(input=>{
    input.addEventListener('change', (e)=>{
      const idx = Number(input.closest('.cart-item').dataset.index);
      const c = loadCart(); c[idx].qty = Number(input.value) || 1; saveCart(c); renderCart();
    });
  });

  // clear / send handlers
  const clearBtn = document.getElementById('clearCart');
  if(clearBtn) clearBtn.onclick = ()=>{ if(confirm('Clear cart?')){ clearCart(); } };
}

// ----- Send order via WhatsApp (and optionally save to Google Sheet) -----
document.addEventListener('DOMContentLoaded', ()=>{
  const sendBtn = document.getElementById('sendWhatsApp');
  if(!sendBtn) return;
  sendBtn.addEventListener('click', function(e){
    e.preventDefault();
    const cart = loadCart();
    if(cart.length === 0){ alert('Your cart is empty'); return; }

    const custName = (document.getElementById('custName')||{value:''}).value.trim() || 'Guest';
    const custPhone = (document.getElementById('custPhone')||{value:''}).value.trim();
    const notes = (document.getElementById('notes')||{value:''}).value.trim();

    if(!custPhone){ alert('Please enter your phone number (with country code).'); return; }

    // Build message
    let total = 0;
    const lines = cart.map(it=>{
      const qty = it.qty || 1; const itemTotal = it.price * qty; total += itemTotal;
      return `${it.name} — $${it.price.toFixed(2)} x ${qty} = $${itemTotal.toFixed(2)}`;
    }).join('\n');

    const message = `Hello The Royal Plate,\nI would like to place an order/reservation:\n\n${lines}\n\nTotal: $${total.toFixed(2)}\nName: ${custName}\nPhone: ${custPhone}\nNotes: ${notes}`;

    // Optional: save to Google Sheet webhook (non-blocking)
    if(SHEET_WEBHOOK){
      const payload = {
        dish: cart.map(i=>i.name).join(', '),
        qty: cart.reduce((s,i)=>s+(i.qty||1),0),
        price: cart.map(i=>i.price).join(','),
        total: total.toFixed(2),
        customerName: custName,
        customerPhone: custPhone,
        notes: notes
      };
      fetch(SHEET_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).catch(()=>{ /* ignore errors client-side */ });
    }

    // Open WhatsApp
    const waUrl = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(message)}`;
    const whLink = document.getElementById('whLink'); if(whLink) whLink.href = waUrl;
    window.open(waUrl, '_blank');

    // clear cart and update UI
    clearCart();
    showToast('WhatsApp opened — please confirm and send your message.');
  });
});
