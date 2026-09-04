import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import {
  ArrowRight,
  BarChart3,
  Brain,
  CalendarCheck,
  CheckCircle,
  GraduationCap,
  Mail,
  Medal,
  ShieldCheck,
  Sparkles,
  Target,
  Trophy
} from 'lucide-react';

const countryCodes = [
  { code: '+1', name: '🇺🇸 +1' },
  { code: '+1', name: '🇨🇦 +1' },
  { code: '+91', name: '🇮🇳 +91' },
  { code: '+44', name: '🇬🇧 +44' },
  { code: '+61', name: '🇦🇺 +61' },
  { code: '+971', name: '🇦🇪 +971' },
  { code: '+65', name: '🇸🇬 +65' },
  { code: '+49', name: '🇩🇪 +49' },
  { code: '+33', name: '🇫🇷 +33' },
  { code: '+39', name: '🇮🇹 +39' },
  { code: '+34', name: '🇪🇸 +34' },
  { code: '+31', name: '🇳🇱 +31' },
  { code: '+41', name: '🇨🇭 +41' },
  { code: '+46', name: '🇸🇪 +46' },
  { code: '+47', name: '🇳🇴 +47' },
  { code: '+45', name: '🇩🇰 +45' },
  { code: '+353', name: '🇮🇪 +353' },
  { code: '+64', name: '🇳🇿 +64' },
  { code: '+27', name: '🇿🇦 +27' },
  { code: '+55', name: '🇧🇷 +55' },
  { code: '+52', name: '🇲🇽 +52' },
  { code: '+81', name: '🇯🇵 +81' },
  { code: '+82', name: '🇰🇷 +82' },
  { code: '+86', name: '🇨🇳 +86' },
  { code: '+852', name: '🇭🇰 +852' },
  { code: '+60', name: '🇲🇾 +60' },
  { code: '+63', name: '🇵🇭 +63' },
  { code: '+966', name: '🇸🇦 +966' },
  { code: '+974', name: '🇶🇦 +974' },
  { code: '+968', name: '🇴🇲 +968' },
  { code: '+965', name: '🇰🇼 +965' },
  { code: '+973', name: '🇧🇭 +973' },
  { code: '+92', name: '🇵🇰 +92' },
  { code: '+880', name: '🇧🇩 +880' },
  { code: '+94', name: '🇱🇰 +94' },
  { code: '+977', name: '🇳🇵 +977' },
  { code: '+20', name: '🇪🇬 +20' },
  { code: '+234', name: '🇳🇬 +234' },
  { code: '+254', name: '🇰🇪 +254' },
  { code: '+54', name: '🇦🇷 +54' },
  { code: '+56', name: '🇨🇱 +56' },
  { code: '+57', name: '🇨🇴 +57' }
];

const LandingPage: React.FC = () => {
  const coachingEmail = 'Pawnsposes@gmail.com';
  const [contactForm, setContactForm] = useState({
    name: '',
    email: '',
    countryCode: '+1',
    whatsapp: '',
    ageGroup: 'Under 8',
    interest: 'Personalized coaching',
    mode: 'Online',
    message: ''
  });
  const [contactStatus, setContactStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [contactError, setContactError] = useState('');

  const achievementPhotos = [
    {
      name: 'Aaryan Deepu and Arjun Deepu',
      src: '/achievements/aaryan_deepu_and_arjun_deepu.jpeg'
    },
    {
      name: 'Arin Kulkarni',
      src: '/achievements/arin_kulkarn.jpeg'
    },
    {
      name: 'Arish Praharaj',
      src: '/achievements/arish_praharaj.jpeg'
    },
    {
      name: 'Diego Alfo',
      src: '/achievements/diego_alfo.jpeg'
    },
    {
      name: 'Sofia Stangu',
      src: '/achievements/sofia_stangu.jpeg'
    },
    {
      name: 'Tvam Iyer',
      src: '/achievements/tvam_iyer.jpeg'
    }
  ];
  const achievementLoop = [...achievementPhotos, ...achievementPhotos];
  const achievementCardStyles = [
    'w-[250px] sm:w-[310px] lg:w-[360px]',
    'w-[210px] sm:w-[260px] lg:w-[300px] translate-y-6',
    'w-[235px] sm:w-[285px] lg:w-[330px] -translate-y-3',
    'w-[220px] sm:w-[270px] lg:w-[310px] translate-y-2',
    'w-[255px] sm:w-[320px] lg:w-[370px] -translate-y-5',
    'w-[215px] sm:w-[265px] lg:w-[305px] translate-y-7'
  ];

  const strengths = [
    {
      icon: <GraduationCap className="h-5 w-5" />,
      title: 'Personal coaching',
      text: 'Clear lessons for kids, tournament players, and adult improvers.'
    },
    {
      icon: <Brain className="h-5 w-5" />,
      title: 'Game insight',
      text: 'Analysis turns recent games into practical training priorities.'
    },
    {
      icon: <Target className="h-5 w-5" />,
      title: 'Focused practice',
      text: 'Puzzles, review, and study tasks match the student level.'
    }
  ];

  const stats = [
    { value: '1:1', label: 'Coaching attention' },
    { value: 'All', label: 'Age groups' },
    { value: 'Game', label: 'Based training' }
  ];

  const pricingPlans = [
    {
      name: 'Free',
      price: '$0',
      features: ['5 game analyses per month', 'Basic puzzle generation', 'Simple progress tracking']
    },
    {
      name: 'Premium',
      price: '$9.99',
      features: ['Unlimited game analyses', 'Advanced style detection', 'Weekly reports'],
      popular: true
    },
    {
      name: 'Coach',
      price: '$29.99',
      features: ['Manage students', 'Bulk analysis tools', 'Advanced reporting dashboard']
    }
  ];

  const updateContactField = (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    setContactForm((current) => ({ ...current, [name]: value }));
  };

  const handleContactSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setContactStatus('sending');
    setContactError('');

    const trimmedName = contactForm.name.trim();
    const trimmedEmail = contactForm.email.trim();
    const trimmedWhatsapp = contactForm.whatsapp.trim();
    const fullWhatsappNumber = `${contactForm.countryCode} ${trimmedWhatsapp}`;

    if (!trimmedName || !trimmedEmail || !trimmedWhatsapp) {
      setContactStatus('error');
      setContactError('Please fill in all required fields (Name, Email, and WhatsApp number).');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setContactStatus('error');
      setContactError('Please enter a valid email address (e.g., name@example.com).');
      return;
    }

    const digitsOnly = trimmedWhatsapp.replace(/\D/g, '');
    if (digitsOnly.length < 5 || digitsOnly.length > 14) {
      setContactStatus('error');
      setContactError('Please enter a valid phone number for your selected country code.');
      return;
    }

    const subject = `Coaching request from ${trimmedName || 'Pawnsposes student'}`;

    try {
      const response = await fetch(`https://formsubmit.co/ajax/${coachingEmail}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify({
          _subject: subject,
          _template: 'table',
          _captcha: 'false',
          _replyto: trimmedEmail,
          name: trimmedName,
          email: trimmedEmail,
          whatsapp: fullWhatsappNumber,
          ageGroup: contactForm.ageGroup,
          interest: contactForm.interest,
          preferredMode: contactForm.mode,
          message: contactForm.message
        })
      });
      const result = await response.json();

      if (!response.ok || result.success === false) {
        throw new Error('Contact form submission failed');
      }

      setContactStatus('sent');
      setContactForm({
        name: '',
        email: '',
        countryCode: '+1',
        whatsapp: '',
        ageGroup: 'Under 8',
        interest: 'Personalized coaching',
        mode: 'Online',
        message: ''
      });
    } catch (error) {
      console.error(error);
      setContactError('Please email us directly if this continues.');
      setContactStatus('error');
    }
  };

  return (
    <div className="min-h-screen bg-[#f7faf5] text-gray-950">
      <section className="relative isolate overflow-hidden bg-primary-900">
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(18,56,38,1)_0%,rgba(9,33,23,1)_48%,rgba(23,70,47,1)_100%)]" />
        <div className="absolute inset-x-0 top-0 h-40 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),transparent)]" />
        <div className="absolute -right-24 top-24 h-80 w-80 rounded-full bg-gold-300/10 blur-3xl" />
        <div className="relative mx-auto grid min-h-[760px] max-w-7xl grid-cols-1 items-center gap-10 px-4 pb-12 pt-28 sm:px-6 sm:pt-32 lg:grid-cols-[minmax(0,0.88fr)_minmax(430px,0.72fr)] lg:gap-16 lg:px-8">
          <div className="max-w-3xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-gold-300/40 bg-white/10 px-3 py-1 text-sm font-medium text-gold-100 backdrop-blur">
              <Sparkles className="h-4 w-4" />
              Chess coaching powered by real game insight
            </div>
            <h1 className="max-w-4xl text-4xl font-bold leading-tight tracking-normal text-white sm:text-5xl lg:text-7xl">
              Pawnsposes builds sharper chess students.
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-8 text-primary-50/90 sm:text-lg">
              Structured coaching, practical analysis, and focused practice for young learners, tournament players, and ambitious improvers.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a href="#coaching-contact">
                <Button size="lg" className="w-full bg-gold-400 text-primary-900 hover:bg-gold-300 sm:w-auto">
                  Request Coaching
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </a>
              <Link to="/register">
                <Button size="lg" variant="outline" className="w-full border-white/30 bg-white/10 text-white hover:bg-white/15 sm:w-auto">
                  Start Free Analysis
                </Button>
              </Link>
            </div>

            <div className="mt-12 grid max-w-3xl grid-cols-3 gap-3">
              {stats.map((stat) => (
                <div key={stat.label} className="border-l border-gold-300/50 pl-4 text-white">
                  <div className="text-2xl font-bold text-gold-200 sm:text-3xl">{stat.value}</div>
                  <div className="mt-1 text-xs uppercase tracking-wide text-primary-50/75 sm:text-sm">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative mx-auto hidden h-[560px] w-full max-w-[500px] md:block lg:justify-self-end">
            <div className="absolute left-1 top-10 z-0 hidden w-36 rotate-[-10deg] rounded-3xl border border-white/20 bg-white/[0.14] p-2 shadow-2xl shadow-black/20 backdrop-blur lg:block xl:left-0 xl:w-36">
              <img
                src="/achievements/tvam_iyer.jpeg"
                alt="Tvam Iyer achievement"
                className="aspect-[3/4] w-full rounded-2xl object-cover object-top"
              />
            </div>
            <div className="absolute right-0 top-28 z-20 hidden w-32 rotate-[7deg] rounded-3xl border border-white/25 bg-white/[0.16] p-2 shadow-2xl shadow-black/25 backdrop-blur lg:block xl:w-36">
              <img
                src="/achievements/sofia_stangu.jpeg"
                alt="Sofia Stangu achievement"
                className="aspect-[3/4] w-full rounded-2xl object-cover object-top"
              />
            </div>
            <div className="absolute bottom-28 left-8 z-20 hidden w-32 rotate-[6deg] rounded-3xl border border-white/25 bg-white/[0.16] p-2 shadow-2xl shadow-black/25 backdrop-blur lg:block xl:w-36">
              <img
                src="/achievements/diego_alfo.jpeg"
                alt="Diego Alfo achievement"
                className="aspect-[3/4] w-full rounded-2xl object-cover object-top"
              />
            </div>
            <div className="relative z-10 ml-auto mr-10 max-w-[350px] rounded-[2rem] border border-white/15 bg-white/10 p-3 shadow-2xl shadow-black/20 backdrop-blur xl:mr-16">
              <div className="overflow-hidden rounded-[1.45rem] bg-primary-900">
                <img
                  src="/achievements/arish_praharaj.jpeg"
                  alt="Arish Praharaj holding a chess trophy"
                  className="h-[410px] w-full object-cover object-center lg:h-[445px]"
                />
              </div>
              <div className="mt-3 flex items-center justify-between rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-primary-900">
                <span>Student achievements</span>
                <Trophy className="h-4 w-4 text-gold-600" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            {strengths.map((item) => (
              <div key={item.title} className="rounded-lg border border-primary-900/10 bg-[#fbfcf8] p-6 shadow-sm">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-primary-800 text-gold-100">
                  {item.icon}
                </div>
                <h2 className="text-lg font-semibold text-primary-900">{item.title}</h2>
                <p className="mt-3 text-sm leading-6 text-gray-600">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="overflow-hidden bg-[#f7faf5] py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl">
              <p className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gold-700">
                <Medal className="h-4 w-4" />
                Achievements
              </p>
              <h2 className="text-3xl font-bold text-primary-900 md:text-5xl">Students making their moves count.</h2>
            </div>
            <p className="max-w-md text-sm leading-6 text-gray-600">
              Pawnsposes students bring their preparation to tournaments, school events, and competitive chess boards.
            </p>
          </div>
        </div>

        <div className="achievement-marquee group relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-20 bg-gradient-to-r from-[#f7faf5] to-transparent sm:w-36" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-20 bg-gradient-to-l from-[#f7faf5] to-transparent sm:w-36" />
          <div className="achievement-track flex w-max gap-5 px-4 py-8 sm:gap-6 sm:px-6 lg:px-8">
            {achievementLoop.map((photo, index) => (
              <figure
                key={`${photo.src}-${index}`}
                className={`${achievementCardStyles[index % achievementCardStyles.length]} flex-shrink-0 overflow-hidden rounded-[1.4rem] bg-white shadow-xl shadow-primary-900/10 ring-1 ring-primary-900/10 transition duration-500 hover:-translate-y-2 hover:shadow-2xl`}
                aria-hidden={index >= achievementPhotos.length}
              >
                <div className="aspect-[3/4] overflow-hidden bg-[#edf3ea]">
                  <img
                    src={photo.src}
                    alt={`${photo.name} achievement`}
                    className="h-full w-full object-contain p-2 transition duration-500 hover:scale-[1.02]"
                    loading={index < 3 ? 'eager' : 'lazy'}
                  />
                </div>
                <figcaption className="flex items-center justify-between gap-3 bg-white px-4 py-3 text-sm font-semibold text-primary-900">
                  <span>{photo.name}</span>
                  <Trophy className="h-4 w-4 flex-shrink-0 text-gold-600" />
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-primary-900 py-16 text-white">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-4 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:px-8">
          <div>
            <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-gold-200">How it works</p>
            <h2 className="text-3xl font-bold md:text-4xl">Simple path, serious improvement.</h2>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {['Share games or goals', 'Find the training priority', 'Practice with a clear plan'].map((step, index) => (
              <div key={step} className="rounded-lg border border-white/15 bg-white/8 p-5">
                <span className="text-sm font-semibold text-gold-200">0{index + 1}</span>
                <p className="mt-3 font-semibold">{step}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-20">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-4 sm:px-6 lg:grid-cols-[0.75fr_1.25fr] lg:px-8">
          <div>
            <p className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gold-700">
              <BarChart3 className="h-4 w-4" />
              Plans
            </p>
            <h2 className="text-3xl font-bold text-primary-900 md:text-4xl">Choose the right training pace.</h2>
            <p className="mt-4 text-sm leading-6 text-gray-600">
              Start with analysis, then move into deeper coaching and progress tracking when ready.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            {pricingPlans.map((plan) => (
              <div key={plan.name} className={`relative rounded-lg border p-6 ${plan.popular ? 'border-gold-400 bg-gold-50 shadow-md' : 'border-primary-900/10 bg-[#fbfcf8]'}`}>
                {plan.popular && (
                  <span className="absolute -top-3 left-4 rounded-full bg-gold-400 px-3 py-1 text-xs font-semibold text-primary-900">
                    Popular
                  </span>
                )}
                <h3 className="text-xl font-bold text-primary-900">{plan.name}</h3>
                <div className="mt-3 text-3xl font-bold text-gray-950">{plan.price}</div>
                <ul className="mt-5 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex gap-2 text-sm text-gray-700">
                      <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary-600" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="coaching-contact" className="bg-[#f7faf5] py-20">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-4 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:px-8">
          <div>
            <p className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gold-700">
              <CalendarCheck className="h-4 w-4" />
              Contact Pawnsposes
            </p>
            <h2 className="text-3xl font-bold text-primary-900 md:text-5xl">Request a class or coaching plan.</h2>
            <p className="mt-5 leading-7 text-gray-600">
              Share the student level, goals, and preferred class mode. Pawnsposes will suggest the next step.
            </p>
            <div className="mt-6 rounded-lg border border-primary-900/10 bg-white p-5 text-sm text-gray-700">
              <div className="mb-2 flex items-center gap-2 font-semibold text-primary-900">
                <Mail className="h-4 w-4 text-gold-600" />
                Direct email
              </div>
              <a href="mailto:contact@pawnsposes.com" className="text-primary-700 hover:text-primary-900">
                contact@pawnsposes.com
              </a>
            </div>
            <div className="mt-6 flex items-center gap-3 text-sm text-primary-900">
              <ShieldCheck className="h-5 w-5 text-gold-600" />
              <span>Thoughtful coaching for steady progress.</span>
            </div>
          </div>

          <form onSubmit={handleContactSubmit} className="rounded-lg border border-primary-900/10 bg-white p-6 shadow-sm">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <label className="text-sm font-medium text-primary-900">
                Student or parent name <span className="text-red-500">*</span>
                <input
                  required
                  name="name"
                  value={contactForm.name}
                  onChange={updateContactField}
                  className="mt-2 h-11 w-full rounded-md border-gray-300 text-sm focus:border-primary-600 focus:ring-primary-600"
                  placeholder="Enter your name"
                />
              </label>
              <label className="text-sm font-medium text-primary-900">
                Email <span className="text-red-500">*</span>
                <input
                  required
                  type="email"
                  name="email"
                  value={contactForm.email}
                  onChange={updateContactField}
                  className="mt-2 h-11 w-full rounded-md border-gray-300 text-sm focus:border-primary-600 focus:ring-primary-600"
                  placeholder="you@example.com"
                />
              </label>
              <label className="text-sm font-medium text-primary-900">
                WhatsApp number <span className="text-red-500">*</span>
                <div className="mt-2 flex rounded-md shadow-sm">
                  <select
                    name="countryCode"
                    value={contactForm.countryCode}
                    onChange={updateContactField}
                    className="h-11 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 pl-2 pr-7 text-xs sm:text-sm font-medium text-gray-700 focus:border-primary-600 focus:ring-primary-600 shrink-0"
                  >
                    {countryCodes.map((item, index) => (
                      <option key={`${item.code}-${index}`} value={item.code}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                  <input
                    required
                    type="tel"
                    name="whatsapp"
                    value={contactForm.whatsapp}
                    onChange={updateContactField}
                    className="h-11 w-full rounded-r-md border border-gray-300 text-sm focus:border-primary-600 focus:ring-primary-600"
                    placeholder="Mobile / WhatsApp number"
                  />
                </div>
              </label>
              <label className="text-sm font-medium text-primary-900">
                Age group
                <select
                  name="ageGroup"
                  value={contactForm.ageGroup}
                  onChange={updateContactField}
                  className="mt-2 h-11 w-full rounded-md border-gray-300 text-sm focus:border-primary-600 focus:ring-primary-600"
                >
                  <option>Under 8</option>
                  <option>8-12</option>
                  <option>13-17</option>
                  <option>Adult learner</option>
                  <option>Coach or school inquiry</option>
                </select>
              </label>
              <label className="text-sm font-medium text-primary-900">
                Interested in
                <select
                  name="interest"
                  value={contactForm.interest}
                  onChange={updateContactField}
                  className="mt-2 h-11 w-full rounded-md border-gray-300 text-sm focus:border-primary-600 focus:ring-primary-600"
                >
                  <option>Personalized coaching</option>
                  <option>Trial class</option>
                  <option>Tournament preparation</option>
                  <option>Game analysis session</option>
                  <option>Group classes</option>
                </select>
              </label>
              <label className="text-sm font-medium text-primary-900">
                Preferred class mode
                <select
                  name="mode"
                  value={contactForm.mode}
                  onChange={updateContactField}
                  className="mt-2 h-11 w-full rounded-md border-gray-300 text-sm focus:border-primary-600 focus:ring-primary-600"
                >
                  <option>Online</option>
                  <option>In-person</option>
                  <option>Hybrid</option>
                  <option>Not sure yet</option>
                </select>
              </label>
              <label className="text-sm font-medium text-primary-900 md:col-span-2">
                Message
                <textarea
                  required
                  name="message"
                  value={contactForm.message}
                  onChange={updateContactField}
                  rows={5}
                  className="mt-2 w-full rounded-md border-gray-300 text-sm focus:border-primary-600 focus:ring-primary-600"
                  placeholder="Share current level, goals, preferred timings, or any questions."
                />
              </label>
            </div>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm">
                {contactStatus === 'sent' && (
                  <p className="font-medium text-primary-800">Thanks. Your inquiry has been sent.</p>
                )}
                {contactStatus === 'error' && (
                  <p className="font-medium text-red-600">We could not send this right now. {contactError}</p>
                )}
                {contactStatus !== 'sent' && contactStatus !== 'error' && (
                  <p className="text-gray-500">Your inquiry will be sent directly to Pawnsposes.</p>
                )}
              </div>
              <Button type="submit" disabled={contactStatus === 'sending'} className="bg-primary-800 hover:bg-primary-900">
                {contactStatus === 'sending' ? 'Sending...' : 'Send Inquiry'}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </form>
        </div>
      </section>

      <section className="bg-primary-900 py-12">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 text-white sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div>
            <h2 className="text-2xl font-bold">Ready to plan the next chess step?</h2>
            <p className="mt-2 text-sm text-primary-50/75">Bring a goal, a game, or a class request.</p>
          </div>
          <a href="#coaching-contact">
            <Button size="lg" className="w-full bg-gold-400 text-primary-900 hover:bg-gold-300 sm:w-auto">
              Request Coaching
              <Trophy className="ml-2 h-4 w-4" />
            </Button>
          </a>
        </div>
      </section>
    </div>
  );
};

export default LandingPage;
