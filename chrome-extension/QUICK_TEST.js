// QUICK TEST SCRIPT FOR SERVICE WORKER CONSOLE
// Copy this line by line if you can't paste

// Test 1: Check API URL
console.log("API URL:", "https://wishlist.nuvio.cloud/api/preview-link");

// Test 2: Simple fetch test
fetch('https://wishlist.nuvio.cloud/api/preview-link', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ url: 'https://amazon.com/dp/B08N5WRWNW' })
})
.then(r => { console.log('Status:', r.status); return r.json(); })
.then(d => console.log('Response:', d))
.catch(e => console.error('Error:', e.name, e.message));

