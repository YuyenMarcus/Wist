/* ===== Hero Mashup Script ===== */

document.addEventListener('DOMContentLoaded', () => {
    // Animate price drop
    const priceElement = document.querySelector('.price-dropping');
    if (priceElement) {
        const prices = [699, 650, 620, 699, 680, 699];
        let priceIndex = 0;

        setInterval(() => {
            priceIndex = (priceIndex + 1) % prices.length;
            priceElement.textContent = '$' + prices[priceIndex];
        }, 3000);
    }

    // Add hover effects to chaos items
    document.querySelectorAll('.chaos-item').forEach(item => {
        item.addEventListener('mouseenter', () => {
            item.style.transform = `rotate(0deg) scale(1.05)`;
            item.style.zIndex = '10';
        });
        
        item.addEventListener('mouseleave', () => {
            const rotate = getComputedStyle(item).getPropertyValue('--rotate');
            item.style.transform = `rotate(${rotate}) scale(1)`;
            item.style.zIndex = '';
        });
    });

    // Add click effects to wishlist items
    document.querySelectorAll('.wishlist-item').forEach(item => {
        item.addEventListener('click', () => {
            const name = item.querySelector('.item-name').textContent;
            alert(`Opening details for: ${name}`);
        });
    });

    // Smooth scroll reveal for elements
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);

    // Button ripple effects
    document.querySelectorAll('.btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            const rect = this.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            const ripple = document.createElement('span');
            ripple.style.cssText = `
                position: absolute;
                background: rgba(255, 255, 255, 0.4);
                border-radius: 50%;
                transform: scale(0);
                animation: ripple 0.6s linear;
                left: ${x}px;
                top: ${y}px;
                width: 100px;
                height: 100px;
                margin-left: -50px;
                margin-top: -50px;
                pointer-events: none;
            `;
            
            this.style.position = 'relative';
            this.style.overflow = 'hidden';
            this.appendChild(ripple);
            
            setTimeout(() => ripple.remove(), 600);
        });
    });

    // Add ripple animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes ripple {
            to {
                transform: scale(4);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);

    // Navigation signup button
    document.querySelector('.nav-signup')?.addEventListener('click', (e) => {
        e.preventDefault();
        alert('Sign up flow would start here!');
    });

    // CTA buttons
    document.querySelector('.btn-primary')?.addEventListener('click', () => {
        alert('Opening Amazon import flow...');
    });

    document.querySelector('.btn-secondary')?.addEventListener('click', () => {
        alert('Opening Pinterest import flow...');
    });

    console.log('%c🎨 Hero Mashup', 'font-size: 14px; font-weight: bold; color: #8b5cf6;');
    console.log('%cV1 Animations + V2 Typography', 'font-size: 11px; color: #888;');
});
