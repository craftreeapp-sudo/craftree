'use client';

import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';

const inputClass =
  'w-full rounded-lg border border-[#2A3042] bg-[#111827]/80 px-4 py-2.5 text-sm text-[#E8ECF4] placeholder:text-[#5B6478] outline-none transition-colors focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6]/40';

const titleFont =
  'var(--font-space-grotesk), Space Grotesk, system-ui, sans-serif';

export function ContactPageClient() {
  const t = useTranslations('contactPage');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [website, setWebsite] = useState('');
  const [status, setStatus] = useState<
    'idle' | 'sending' | 'success' | 'error' | 'validation'
  >('idle');

  function clearFeedback() {
    if (status === 'error' || status === 'validation') setStatus('idle');
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus('sending');
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, message, website }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
      };

      if (res.status === 400 && data.error === 'invalid_email') {
        setStatus('validation');
        return;
      }
      if (!res.ok) {
        setStatus('error');
        return;
      }
      setStatus('success');
      setName('');
      setEmail('');
      setMessage('');
    } catch {
      setStatus('error');
    }
  }

  return (
    <main
      className="mx-auto w-full max-w-[720px] flex-1 px-6 pb-20 pt-16 font-[family-name:var(--font-inter)] text-[#C8CDD8]"
      style={{ fontFamily: 'var(--font-inter), Inter, system-ui, sans-serif' }}
    >
      <header className="mb-10">
        <h1
          className="text-[32px] font-bold leading-tight text-[#E8ECF4]"
          style={{ fontFamily: titleFont }}
        >
          {t('title')}
        </h1>
        <p className="mt-3 text-base text-[#8B95A8]">{t('intro')}</p>
      </header>

      {status === 'success' ? (
        <p
          className="rounded-lg border border-[#166534]/50 bg-[#14532d]/30 px-4 py-3 text-sm text-[#86EFAC]"
          role="status"
        >
          {t('success')}
        </p>
      ) : (
        <form className="space-y-5" onSubmit={onSubmit} noValidate>
          <div className="hidden" aria-hidden="true">
            <input
              id="contact-website"
              name="website"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label
              htmlFor="contact-name"
              className="mb-1.5 block text-sm font-medium text-[#E8ECF4]"
            >
              {t('nameLabel')}
            </label>
            <input
              id="contact-name"
              name="name"
              type="text"
              required
              autoComplete="name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                clearFeedback();
              }}
              placeholder={t('namePlaceholder')}
              className={inputClass}
            />
          </div>

          <div>
            <label
              htmlFor="contact-email"
              className="mb-1.5 block text-sm font-medium text-[#E8ECF4]"
            >
              {t('emailLabel')}
            </label>
            <input
              id="contact-email"
              name="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                clearFeedback();
              }}
              placeholder={t('emailPlaceholder')}
              className={inputClass}
            />
          </div>

          <div>
            <label
              htmlFor="contact-message"
              className="mb-1.5 block text-sm font-medium text-[#E8ECF4]"
            >
              {t('messageLabel')}
            </label>
            <textarea
              id="contact-message"
              name="message"
              required
              rows={6}
              value={message}
              onChange={(e) => {
                setMessage(e.target.value);
                clearFeedback();
              }}
              placeholder={t('messagePlaceholder')}
              className={`${inputClass} min-h-[140px] resize-y`}
            />
          </div>

          {status === 'validation' ? (
            <p className="text-sm text-amber-400/90" role="alert">
              {t('errorEmail')}
            </p>
          ) : null}
          {status === 'error' ? (
            <p className="text-sm text-red-400/90" role="alert">
              {t('error')}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={status === 'sending'}
            className="rounded-lg bg-[#3B82F6] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#2563EB] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {status === 'sending' ? t('sending') : t('submit')}
          </button>
        </form>
      )}
    </main>
  );
}
