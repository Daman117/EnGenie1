import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Brain, BarChart, Zap, Shield, ChevronRight } from 'lucide-react';
import ScrollAnimation from '../components/ScrollAnimation';

const Landing = () => {
  const navigate = useNavigate();

  const features = [
    {
      image: "/icon-brain-3d.png",
      title: "Company-Personalized Matching",
      description: "Recommendations aligned to your approved strategy, engineering standards, and inventory availability."
    },
    {
      image: "/icon-chart-3d.png",
      title: "Intelligent Vendor Analysis",
      description: "Side-by-side comparison and scoring across technical fit, compliance, and commercial factors."
    },
    {
      image: "/icon-lightning-3d.png",
      title: "Real-time Validation",
      description: "Instant requirement checks, missing-field prompts, and fast shortlisting."
    },
    {
      image: "/icon-shield-3d.png",
      title: "Secure & Reliable",
      description: "Enterprise-grade security with consistent, explainable outputs you can trust."
    }
  ];

  const productTypes = [
    "Pressure Transmitter",
    "Temperature Transmitter",
    "Humidity Transmitter",
    "Flow Meter",
    "Level Transmitter",
    "pH Sensors"
  ];

  return (
    <div className="min-h-screen app-glass-gradient text-foreground">
      {/* Header */}
      <header className="glass-header">
        <div className="w-full px-6 py-4 flex items-center justify-end">
          <div className="flex items-center gap-4">
            <button className="btn-glass-secondary px-6 py-2 rounded-full font-medium" onClick={() => navigate('/login')}>Login</button>
            <button className="btn-glass-primary px-6 py-2 rounded-full font-medium shadow-lg hover:shadow-xl" onClick={() => navigate('/signup')}>Sign Up</button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <ScrollAnimation>
        <section className="relative overflow-hidden">
          <div className="relative max-w-7xl mx-auto px-6 py-24 text-center">
            <div className="w-24 h-24 mx-auto mb-8">
              <img src="/ChatGPT Image Nov 11, 2025, 11_58_30 AM.png" alt="Logo" className="w-full h-full rounded-full object-cover shadow-md" />
            </div>
            <h1 className="text-5xl md:text-6xl font-extrabold mb-6">
              Welcome to{' '}
              <span className="text-gradient inline-block">
                EnGenie
              </span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-10">
              Intelligent product matching powered by an advanced AI pipeline. Describe your requirements and get personalized recommendations with comprehensive vendor analysis<span className="text-foreground">—tailored to your company’s Strategy, Standards, and Inventory.</span>
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button className="btn-glass-primary px-6 py-3 text-base inline-flex items-center justify-center" onClick={() => navigate('/signup')}>
                Get Started
                <ChevronRight className="ml-2 w-4 h-4" />
              </button>
              <button className="btn-glass-secondary px-6 py-3 text-base" onClick={() => navigate('/login')}>
                Sign In
              </button>
            </div>
          </div>
        </section>
      </ScrollAnimation>

      {/* Features Section */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-6">
          <ScrollAnimation>
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold mb-4 text-gradient inline-block">
                Powerful AI-Driven Features
              </h2>
              <p className="text-lg text-muted-foreground">
                Experience the next generation of product recommendation technology
              </p>
            </div>
          </ScrollAnimation>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <ScrollAnimation key={index}>
                <div
                  className="glass-card p-6 group hover:scale-105 transition-transform duration-300 border-white/20 !bg-white/10 hover:!bg-white/20 h-full"
                >
                  <div className="text-center">
                    <div className="mb-6 relative flex items-center justify-center transform transition-transform duration-300 group-hover:scale-110">
                      <img
                        src={feature.image}
                        alt={feature.title}
                        className="w-24 h-24 object-contain mix-blend-multiply filter contrast-125 drop-shadow-xl"
                      />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-center text-sm leading-relaxed">{feature.description}</p>
                  </div>
                </div>
              </ScrollAnimation>
            ))}
          </div>
        </div>
      </section>

      {/* Product Types Section */}
      <ScrollAnimation>
        <section className="py-16">
          <div className="relative max-w-7xl mx-auto px-6 text-center">
            <h2 className="text-3xl font-bold mb-3">Supported Product Categories</h2>
            <p className="text-base text-muted-foreground mb-8">
              Comprehensive analysis across various industrial sensor types
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {productTypes.map((type, index) => (
                <div
                  key={index}
                  className="p-4 font-medium transition-all duration-300 text-base flex items-center justify-center min-h-[50px] hover:scale-102"
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.35)',
                    backdropFilter: 'blur(16px)',
                    WebkitBackdropFilter: 'blur(16px)',
                    border: '1px solid rgba(255, 255, 255, 0.4)',
                    borderRadius: '0.75rem',
                    boxShadow: '0 4px 30px rgba(0, 0, 0, 0.15)',
                    transition: 'all 0.3s ease',
                    cursor: 'pointer',
                    width: '100%',
                    textAlign: 'center'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.5)';
                    e.currentTarget.style.backdropFilter = 'blur(20px)';
                    e.currentTarget.style.WebkitBackdropFilter = 'blur(20px)';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.6)';
                    e.currentTarget.style.transform = 'scale(1.02)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.35)';
                    e.currentTarget.style.backdropFilter = 'blur(16px)';
                    e.currentTarget.style.WebkitBackdropFilter = 'blur(16px)';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.4)';
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                >
                  {type}
                </div>
              ))}
            </div>
          </div>
        </section>
      </ScrollAnimation>

      {/* CTA Section */}
      <ScrollAnimation>
        <section className="py-24 text-center">
          <div className="glass-card popup-blur-card p-12 max-w-4xl mx-auto border-white/30 !bg-white/15 hover:!bg-white/25 hover:shadow-2xl transition-all duration-300">
            <h2 className="text-4xl font-bold mb-6 text-gradient inline-block">
              Ready to Find Your Perfect Product?
            </h2>
            <p className="text-xl text-muted-foreground mb-8 text-center max-w-2xl mx-auto">
              Join teams who trust EnGenie to standardize selection, reduce rework, and accelerate decisions. Product type detection starts automatically upon entering your requirements.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button className="btn-glass-primary px-8 py-3 text-lg rounded-full inline-flex items-center justify-center shadow-lg hover:shadow-xl hover:scale-105 transition-all" onClick={() => navigate('/signup')}>
                Create Account
                <ChevronRight className="ml-2 w-5 h-5" />
              </button>
              <button className="btn-glass-secondary px-8 py-3 text-lg rounded-full shadow-md hover:shadow-lg hover:scale-105 transition-all" onClick={() => navigate('/login')}>
                I Already Have an Account
              </button>
            </div>
          </div>
        </section>
      </ScrollAnimation>

      {/* Footer */}
      <footer className="border-t border-border py-8 text-muted-foreground text-sm text-center">
        © 2026 EnGenie. Powered by advanced AI pipeline.
      </footer>
    </div>
  );
};

export default Landing;
