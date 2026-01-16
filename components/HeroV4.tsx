'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface HeroV4Props {
  isLoggedIn: boolean
}

export default function HeroV4({ isLoggedIn }: HeroV4Props) {
  const router = useRouter()
  const [priceIndex, setPriceIndex] = useState(0)

  const prices = [699, 650, 620, 699, 680, 699]

  useEffect(() => {
    // Animate price drop
    const interval = setInterval(() => {
      setPriceIndex((prev) => (prev + 1) % prices.length)
    }, 3000)

    return () => clearInterval(interval)
  }, [])

  const handlePrimaryClick = (e: React.MouseEvent) => {
    e.preventDefault()
    if (isLoggedIn) {
      router.push('/dashboard')
    } else {
      router.push('/signup')
    }
  }

  const handleSecondaryClick = (e: React.MouseEvent) => {
    e.preventDefault()
    if (isLoggedIn) {
      router.push('/dashboard')
    } else {
      router.push('/signup')
    }
  }

  return (
    <div className="hero">
      {/* Background Effects */}
      <div className="bg-gradient"></div>
      <div className="bg-grid"></div>

      {/* Navigation */}
      <nav className="nav">
        <div className="nav-logo">
          <img src="/logo.svg" alt="Wist Logo" className="logo-image" />
        </div>
        <div className="nav-actions">
          {isLoggedIn ? (
            <Link href="/dashboard" className="nav-signup">
              Dashboard
            </Link>
          ) : (
            <>
              <Link href="/login" className="nav-login">Log In</Link>
              <Link href="/signup" className="nav-signup">Get Started</Link>
            </>
          )}
        </div>
      </nav>

      {/* Hero Main Content */}
      <main className="hero-main">
        <div className="hero-content">
          {/* Headline - Playfair Display Typography */}
          <h1 className="hero-headline">
            <span className="headline-line">Stop Forgetting</span>
            <span className="headline-line">What You Want</span>
            <span className="headline-line">To Buy</span>
          </h1>

          {/* Subheadline */}
          <p className="hero-subheadline">
            Save everything you want in one place. <span className="highlight">Get alerts when prices drop.</span> 
            Share with friends. Never screenshot another product again.
          </p>

          {/* CTA Buttons - V2 Styling */}
          <div className="hero-cta">
            <button className="btn btn-primary" onClick={handlePrimaryClick}>
              <svg className="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15V19C21 20.1 20.1 21 19 21H5C3.9 21 3 20.1 3 19V15"/>
                <path d="M17 8L12 3L7 8"/>
                <path d="M12 3V15"/>
              </svg>
              <span className="btn-text">{isLoggedIn ? 'Go to Dashboard' : 'Import Your Wishlist — Free'}</span>
            </button>
            <button className="btn btn-secondary" onClick={handleSecondaryClick}>
              <svg className="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2L12 22"/>
                <path d="M2 12L22 12"/>
              </svg>
              <span>{isLoggedIn ? 'Add New Item' : 'Add First Item'}</span>
            </button>
          </div>

          {/* Trust Line - V2 Style */}
          <div className="trust-signals">
            <div className="trust-item">
              <svg className="trust-icon" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"/>
              </svg>
              <span><strong>10,247</strong> items tracked</span>
            </div>
            <div className="trust-item">
              <svg className="trust-icon" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"/>
              </svg>
              <span><strong>$127,493</strong> saved by users</span>
            </div>
            <div className="trust-item">
              <svg className="trust-icon" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"/>
              </svg>
              <span><strong>Free</strong> forever</span>
            </div>
          </div>

          {/* Social Proof - V2 Style */}
          <div className="social-proof">
            <div className="avatars">
              <div className="avatar" style={{ '--i': 0 } as React.CSSProperties}>
                <img src="https://i.pravatar.cc/40?img=1" alt="User" />
              </div>
              <div className="avatar" style={{ '--i': 1 } as React.CSSProperties}>
                <img src="https://i.pravatar.cc/40?img=2" alt="User" />
              </div>
              <div className="avatar" style={{ '--i': 2 } as React.CSSProperties}>
                <img src="https://i.pravatar.cc/40?img=3" alt="User" />
              </div>
              <div className="avatar" style={{ '--i': 3 } as React.CSSProperties}>
                <img src="https://i.pravatar.cc/40?img=4" alt="User" />
              </div>
              <div className="avatar avatar-more" style={{ '--i': 4 } as React.CSSProperties}>+9k</div>
            </div>
            <span className="social-text">Join <strong>10,000+</strong> smart shoppers</span>
          </div>
        </div>

        {/* Hero Visual - V1 Animated Comparison */}
        <div className="hero-visual">
          <div className="comparison-container">
            {/* OLD WAY - Left Side */}
            <div className="comparison-side old-way">
              <div className="side-label">
                <span className="label-dot red"></span>
                The Old Way
              </div>
              <div className="chaos-container">
                <div className="chaos-item note" style={{ '--delay': '0.1s', '--x': '10%', '--y': '15%', '--rotate': '-12deg' } as React.CSSProperties}>
                  <div className="note-header">📝 Notes</div>
                  <div className="note-content">
                    Check headphones price...<br/>
                    Amazon link somewhere?<br/>
                    Was it $89 or $99??
                  </div>
                </div>
                <div className="chaos-item browser" style={{ '--delay': '0.3s', '--x': '45%', '--y': '8%', '--rotate': '8deg' } as React.CSSProperties}>
                  <div className="browser-bar">
                    <span className="browser-dots"></span>
                    <span className="browser-url">amazon.com/dp/...</span>
                  </div>
                  <div className="browser-content">
                    <div className="skeleton-img"></div>
                    <div className="skeleton-text"></div>
                  </div>
                </div>
                <div className="chaos-item bookmark" style={{ '--delay': '0.5s', '--x': '5%', '--y': '55%', '--rotate': '-5deg' } as React.CSSProperties}>
                  <div className="bookmark-icon">🔖</div>
                  <span>47 unsorted bookmarks</span>
                </div>
                <div className="chaos-item screenshot" style={{ '--delay': '0.7s', '--x': '50%', '--y': '50%', '--rotate': '15deg' } as React.CSSProperties}>
                  <div className="screenshot-content">
                    <div className="blurry-img"></div>
                    <span>IMG_2847.png</span>
                  </div>
                </div>
                <div className="chaos-item spreadsheet" style={{ '--delay': '0.9s', '--x': '25%', '--y': '75%', '--rotate': '-8deg' } as React.CSSProperties}>
                  <div className="spreadsheet-grid">
                    <div className="cell">Item</div>
                    <div className="cell">Price</div>
                    <div className="cell">???</div>
                    <div className="cell">$??</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="comparison-divider">
              <div className="divider-line"></div>
              <div className="divider-vs">VS</div>
              <div className="divider-line"></div>
            </div>

            {/* NEW WAY - Right Side */}
            <div className="comparison-side new-way">
              <div className="side-label">
                <span className="label-dot green"></span>
                With Wist
              </div>
              <div className="wist-app">
                <div className="app-header">
                  <div className="app-logo">
                    <svg viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                      <path d="M8 12L11 15L16 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Wist
                  </div>
                  <div className="app-stats">
                    <span className="stat-badge">3 items tracking</span>
                  </div>
                </div>
                
                <div className="wishlist-items">
                  {/* Item 1 */}
                  <div className="wishlist-item" style={{ '--delay': '0.2s' } as React.CSSProperties}>
                    <div className="item-image headphones"></div>
                    <div className="item-details">
                      <div className="item-name">Sony WH-1000XM5</div>
                      <div className="item-price">
                        <span className="price-current">$278</span>
                        <span className="price-original">$349</span>
                        <span className="price-badge">-20%</span>
                      </div>
                    </div>
                    <div className="item-chart">
                      <svg viewBox="0 0 60 30" className="mini-chart">
                        <polyline points="0,25 15,20 25,22 35,15 45,18 60,8" fill="none" stroke="currentColor" strokeWidth="2"/>
                      </svg>
                    </div>
                  </div>

                  {/* Item 2 with price drop animation */}
                  <div className="wishlist-item featured" style={{ '--delay': '0.4s' } as React.CSSProperties}>
                    <div className="item-image watch"></div>
                    <div className="item-details">
                      <div className="item-name">Apple Watch Ultra 2</div>
                      <div className="item-price">
                        <span className="price-current price-dropping">${prices[priceIndex]}</span>
                        <span className="price-original">$799</span>
                        <span className="price-badge price-badge-animate">-13%</span>
                      </div>
                    </div>
                    <div className="item-chart">
                      <svg viewBox="0 0 60 30" className="mini-chart dropping">
                        <polyline points="0,10 15,12 25,8 35,15 45,12 55,20 60,25" fill="none" stroke="currentColor" strokeWidth="2"/>
                      </svg>
                    </div>
                    {/* Price drop notification */}
                    <div className="price-notification">
                      <div className="notification-icon">📉</div>
                      <div className="notification-text">
                        <strong>Price dropped!</strong>
                        <span>Now $100 cheaper</span>
                      </div>
                    </div>
                  </div>

                  {/* Item 3 */}
                  <div className="wishlist-item" style={{ '--delay': '0.6s' } as React.CSSProperties}>
                    <div className="item-image camera"></div>
                    <div className="item-details">
                      <div className="item-name">Fujifilm X-T5</div>
                      <div className="item-price">
                        <span className="price-current">$1,699</span>
                        <span className="price-waiting">Waiting for drop...</span>
                      </div>
                    </div>
                    <div className="item-chart">
                      <svg viewBox="0 0 60 30" className="mini-chart stable">
                        <polyline points="0,15 15,14 25,15 35,14 45,15 60,14" fill="none" stroke="currentColor" strokeWidth="2"/>
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
