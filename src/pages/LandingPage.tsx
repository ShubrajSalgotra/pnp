import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Brain,
  CalendarCheck,
  CheckCircle,
  FileText,
  GraduationCap,
  Mail,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  Target,
  Trophy,
  Users
} from 'lucide-react';

const LandingPage: React.FC = () => {
  const coachingEmail = 'hello@pawnsposes.com';
  const [contactForm, setContactForm] = useState({
    name: '',
    email: '',
    ageGroup: 'Under 8',
    interest: 'Personalized coaching',
    mode: 'Online',
    message: ''
  });

  const features = [
    {
      icon: <BarChart3 className="h-5 w-5" />,
      title: 'Game Analysis',
      description: 'Review imported games with engine-backed insights, recurring mistakes, and practical next steps.'
    },
    {
      icon: <Brain className="h-5 w-5" />,
      title: 'Playing Style Detection',
      description: 'Identify whether your patterns are tactical, positional, aggressive, cautious, or mixed.'
    },
    {
      icon: <Target className="h-5 w-5" />,
      title: 'Personalized Puzzles',
      description: 'Train from positions connected to your own games, not generic puzzle queues.'
    },
    {
      icon: <FileText className="h-5 w-5" />,
      title: 'Performance Reports',
      description: 'Generate polished progress reports for players, parents, and coaches.'
    },
    {
      icon: <Users className="h-5 w-5" />,
      title: 'Parent & Coach Tools',
      description: 'Keep learning plans, student progress, and improvement priorities in one workspace.'
    },
    {
      icon: <BookOpen className="h-5 w-5" />,
      title: 'Study Guidance',
      description: 'Move from diagnosis to study with curated learning resources and focused recommendations.'
    },
    {
      icon: <GraduationCap className="h-5 w-5" />,
      title: 'Personalized Coaching',
      description: 'Get structured coaching for kids, teens, adults, tournament players, and returning learners.'
    }
  ];

  const workflow = [
    'Connect your games or share your goals',
    'Analyze strengths, gaps, and learning style',
    'Follow a coaching plan built around you'
  ];

  const coachingPaths = [
    {
      title: 'Young Learners',
      description: 'Fun, confidence-building classes for children learning fundamentals, tactics, and healthy tournament habits.'
    },
    {
      title: 'School & Tournament Players',
      description: 'Focused preparation with opening direction, calculation routines, game review, and weekly practice goals.'
    },
    {
      title: 'Adults & Improvers',
      description: 'Flexible coaching for busy learners who want clearer plans, better decision-making, and consistent progress.'
    }
  ];

  const pricingPlans = [
    {
      name: 'Free',
      price: '$0',
      period: 'forever',
      features: ['5 game analyses per month', 'Basic puzzle generation', 'Simple progress tracking'],
      cta: 'Get Started',
      popular: false
    },
    {
      name: 'Premium',
      price: '$9.99',
      period: 'per month',
      features: ['Unlimited game analyses', 'Advanced style detection', 'Weekly detailed reports', 'YouTube recommendations'],
      cta: 'Start Free Trial',
      popular: true
    },
    {
      name: 'Coach',
      price: '$29.99',
      period: 'per month',
      features: ['Everything in Premium', 'Manage multiple students', 'Bulk analysis tools', 'Advanced reporting dashboard'],
      cta: 'Contact Sales',
      popular: false
    }
  ];

  const updateContactField = (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    setContactForm((current) => ({ ...current, [name]: value }));
  };

  const handleContactSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const subject = `Coaching request from ${contactForm.name || 'Pawnsposes student'}`;
    const body = [
      `Name: ${contactForm.name}`,
      `Email: ${contactForm.email}`,
      `Age group: ${contactForm.ageGroup}`,
      `Interest: ${contactForm.interest}`,
      `Preferred mode: ${contactForm.mode}`,
      '',
      'Message:',
      contactForm.message
    ].join('\n');

    window.location.href = `mailto:${coachingEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  return (
    <div className="min-h-screen bg-[#f7faf5] text-gray-950">
      <section className="relative overflow-hidden bg-primary-900">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_28%_18%,rgba(248,204,71,0.22),transparent_30%),linear-gradient(135deg,rgba(18,56,38,0),rgba(0,0,0,0.24))]" />
        <div className="relative mx-auto grid min-h-[calc(100vh-4rem)] max-w-7xl grid-cols-1 items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8">
          <div className="max-w-3xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-gold-300/30 bg-white/10 px-3 py-1 text-sm font-medium text-gold-100">
              <Sparkles className="h-4 w-4" />
              AI-powered chess improvement
            </div>
            <h1 className="text-4xl font-bold leading-tight text-white md:text-6xl">
              Pawnsposes turns every game into a clearer training plan.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-primary-50/85">
              Learn chess with personalized coaching for every age group, supported by game analysis, targeted puzzles, and progress reports that make improvement easier to follow.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link to="/register">
                <Button size="lg" className="w-full bg-gold-400 text-primary-950 hover:bg-gold-300 sm:w-auto">
                  Start Free Analysis
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <a href="#coaching-contact">
                <Button size="lg" variant="outline" className="w-full border-white/25 bg-white/5 text-white hover:bg-white/10 sm:w-auto">
                  Request Coaching
                </Button>
              </a>
            </div>
          </div>

          <div className="lg:justify-self-end">
            <div className="rounded-2xl border border-white/12 bg-white/8 p-5 shadow-2xl backdrop-blur">
              <img
                src="/pnp_logo.jpeg"
                alt="Pawnsposes logo"
                className="aspect-square w-full max-w-[460px] rounded-xl object-cover"
              />
              <div className="mt-5 grid grid-cols-3 gap-3 text-center text-sm">
                <div className="rounded-lg bg-white/10 p-3 text-white">
                  <div className="text-lg font-bold text-gold-200">1:1</div>
                  Coaching
                </div>
                <div className="rounded-lg bg-white/10 p-3 text-white">
                  <div className="text-lg font-bold text-gold-200">All</div>
                  Ages
                </div>
                <div className="rounded-lg bg-white/10 p-3 text-white">
                  <div className="text-lg font-bold text-gold-200">1</div>
                  Plan
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white py-20">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
          <div>
            <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-gold-700">Personalized coaching</p>
            <h2 className="text-3xl font-bold text-primary-950 md:text-4xl">Chess coaching for every age, goal, and learning pace.</h2>
            <p className="mt-5 leading-7 text-gray-600">
              Pawnsposes combines human coaching with practical analysis, so each student gets a plan that matches their current level, schedule, and ambitions.
            </p>
            <div className="mt-8 grid grid-cols-1 gap-4">
              {coachingPaths.map((path) => (
                <div key={path.title} className="rounded-lg border border-primary-900/10 bg-[#fbfcf8] p-5">
                  <div className="mb-2 flex items-center gap-2 text-primary-900">
                    <GraduationCap className="h-5 w-5 text-gold-600" />
                    <h3 className="font-semibold">{path.title}</h3>
                  </div>
                  <p className="text-sm leading-6 text-gray-600">{path.description}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3 lg:self-center">
            <Card className="border-primary-900/10">
              <CardHeader>
                <CalendarCheck className="mb-2 h-6 w-6 text-primary-700" />
                <CardTitle className="text-lg text-primary-950">Class Requests</CardTitle>
                <CardDescription>Request a trial class, regular coaching slot, or tournament preparation plan.</CardDescription>
              </CardHeader>
            </Card>
            <Card className="border-primary-900/10">
              <CardHeader>
                <Target className="mb-2 h-6 w-6 text-primary-700" />
                <CardTitle className="text-lg text-primary-950">Personal Goals</CardTitle>
                <CardDescription>Build around ratings, confidence, opening clarity, tactics, or long-term mastery.</CardDescription>
              </CardHeader>
            </Card>
            <Card className="border-primary-900/10">
              <CardHeader>
                <MessageSquare className="mb-2 h-6 w-6 text-primary-700" />
                <CardTitle className="text-lg text-primary-950">Parent Updates</CardTitle>
                <CardDescription>Keep families informed with clear progress notes and next-step recommendations.</CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      <section className="border-b border-primary-900/10 bg-white py-10">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-4 px-4 sm:px-6 md:grid-cols-3 lg:px-8">
          {workflow.map((item, index) => (
            <div key={item} className="flex items-center gap-3 rounded-lg border border-primary-900/10 bg-[#fbfcf8] p-4">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-800 text-sm font-semibold text-gold-100">
                {index + 1}
              </span>
              <span className="font-medium text-primary-950">{item}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-[#f7faf5] py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-12 max-w-2xl">
            <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-gold-700">Improvement tools</p>
            <h2 className="text-3xl font-bold text-primary-950 md:text-4xl">A focused command center for serious chess growth.</h2>
          </div>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <Card key={feature.title} className="border-primary-900/10 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
                <CardHeader>
                  <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-lg bg-primary-50 text-primary-700 ring-1 ring-primary-900/10">
                    {feature.icon}
                  </div>
                  <CardTitle className="text-xl text-primary-950">{feature.title}</CardTitle>
                  <CardDescription className="leading-6 text-gray-600">{feature.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-20">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-4 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:px-8">
          <div>
            <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-gold-700">Plans</p>
            <h2 className="text-3xl font-bold text-primary-950 md:text-4xl">Start simple, then scale with your training.</h2>
            <p className="mt-4 text-gray-600">Choose the workspace that matches how you learn, coach, or track progress.</p>
          </div>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            {pricingPlans.map((plan) => (
              <Card key={plan.name} className={`relative border-primary-900/10 ${plan.popular ? 'ring-2 ring-gold-400' : ''}`}>
                {plan.popular && (
                  <span className="absolute -top-3 left-4 rounded-full bg-gold-400 px-3 py-1 text-xs font-semibold text-primary-950">
                    Most Popular
                  </span>
                )}
                <CardHeader>
                  <CardTitle className="text-xl text-primary-950">{plan.name}</CardTitle>
                  <div className="pt-2">
                    <span className="text-3xl font-bold">{plan.price}</span>
                    <span className="text-sm text-gray-500">/{plan.period}</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="mb-6 space-y-3">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex gap-2 text-sm text-gray-700">
                        <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary-600" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Button className="w-full" variant={plan.popular ? 'default' : 'outline'}>
                    {plan.cta}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section id="coaching-contact" className="bg-[#f7faf5] py-20">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-4 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:px-8">
          <div>
            <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-gold-700">Contact Pawnsposes</p>
            <h2 className="text-3xl font-bold text-primary-950 md:text-4xl">Send a class request or coaching inquiry.</h2>
            <p className="mt-5 leading-7 text-gray-600">
              Tell us a little about the student, goals, and preferred class format. We will use your message to recommend the right coaching path.
            </p>
            <div className="mt-6 rounded-lg border border-primary-900/10 bg-white p-5 text-sm text-gray-700">
              <div className="mb-2 flex items-center gap-2 font-semibold text-primary-950">
                <Mail className="h-4 w-4 text-gold-600" />
                Direct email
              </div>
              <a href={`mailto:${coachingEmail}`} className="text-primary-700 hover:text-primary-900">
                {coachingEmail}
              </a>
            </div>
          </div>

          <form onSubmit={handleContactSubmit} className="rounded-xl border border-primary-900/10 bg-white p-6 shadow-sm">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <label className="text-sm font-medium text-primary-950">
                Student or parent name
                <input
                  required
                  name="name"
                  value={contactForm.name}
                  onChange={updateContactField}
                  className="mt-2 h-11 w-full rounded-md border-gray-300 text-sm focus:border-primary-600 focus:ring-primary-600"
                  placeholder="Enter your name"
                />
              </label>
              <label className="text-sm font-medium text-primary-950">
                Email
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
              <label className="text-sm font-medium text-primary-950">
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
              <label className="text-sm font-medium text-primary-950">
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
              <label className="text-sm font-medium text-primary-950 md:col-span-2">
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
              <label className="text-sm font-medium text-primary-950 md:col-span-2">
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
              <p className="text-sm text-gray-500">Submitting opens your email app with these details filled in.</p>
              <Button type="submit" className="bg-primary-800 hover:bg-primary-900">
                Send Inquiry
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </form>
        </div>
      </section>

      <section className="bg-primary-900 py-16">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div>
            <div className="mb-3 flex items-center gap-2 text-gold-200">
              <ShieldCheck className="h-5 w-5" />
              <span className="text-sm font-semibold uppercase tracking-wide">Built for steady progress</span>
            </div>
            <h2 className="text-3xl font-bold text-white">Ready for a clearer chess journey?</h2>
            <p className="mt-3 max-w-2xl text-primary-50/80">Bring your games, goals, or class request and let Pawnsposes shape the right improvement plan.</p>
          </div>
          <a href="#coaching-contact">
            <Button size="lg" className="w-full bg-gold-400 text-primary-950 hover:bg-gold-300 sm:w-auto">
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
