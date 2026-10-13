import { useEffect, useRef, useState } from 'react';
import Icon from './Icons';
import type { IconName } from './Icons';
import { toTelHref } from '../lib/contact';
import type { ContactInfo } from '../lib/contact';

/** Invisible break opportunity (U+200B), put after the @ so long addresses wrap in one clean place. */
const ZERO_WIDTH_SPACE = String.fromCharCode(0x200b);

interface ContactCardProps {
  contact: ContactInfo;
  className?: string;
}

interface RowProps {
  icon: IconName;
  label: string;
  href?: string;
  copied: string | null;
  onCopy: (value: string) => void;
  /** Value written to the clipboard (defaults to label) */
  copyValue?: string;
}

function ContactRow({ icon, label, href, copied, onCopy, copyValue }: RowProps) {
  const value = copyValue ?? label;
  const isCopied = copied === value;
  return (
    <li className="contact-item">
      <a className="contact-mail" href={href}>
        <Icon name={icon} size={16} />
        {/* A zero-width space after the @ gives long addresses one clean place to wrap */}
        <span>{label.replace('@', `@${ZERO_WIDTH_SPACE}`)}</span>
      </a>
      <button
        type="button"
        className={`contact-copy ${isCopied ? 'copied' : ''}`}
        onClick={() => onCopy(value)}
        aria-label={isCopied ? 'Kopiert' : `${value} kopieren`}
        title={isCopied ? 'Kopiert' : 'Kopieren'}
      >
        <Icon name={isCopied ? 'check' : 'copy'} size={16} />
      </button>
    </li>
  );
}

/**
 * Sidebar block with everything the description states about who to contact: named people
 * (with their own number when the text gives one), further phone numbers and e-mail addresses.
 */
export default function ContactCard({ contact, className = '' }: ContactCardProps) {
  const [copied, setCopied] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      return; // Clipboard unavailable (insecure context / denied): the links still work
    }
    setCopied(value);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(null), 1800);
  };

  const digits = (p: string) => p.replace(/\D/g, '');
  const attached = new Set(contact.people.flatMap((p) => (p.phone ? [digits(p.phone)] : [])));
  const loosePhones = contact.phones.filter((p) => !attached.has(digits(p)));

  if (contact.people.length === 0 && loosePhones.length === 0 && contact.emails.length === 0) return null;

  return (
    <section className={`detail-card aside-card ${className}`} aria-label="Kontakt">
      <h2 className="aside-title">Kontakt</h2>

      {contact.people.length > 0 && (
        <div className="contact-group">
          <h3 className="contact-subtitle">{contact.people.length > 1 ? 'Ansprechpersonen' : 'Ansprechperson'}</h3>
          <ul className="contact-list">
            {contact.people.map((person) => (
              <li key={person.name} className="contact-person">
                <div className="contact-person-head">
                  <span className="fact-icon">
                    <Icon name="user" size={16} />
                  </span>
                  <div className="contact-person-name">
                    <strong>{person.name}</strong>
                    {person.role && <span>{person.role}</span>}
                  </div>
                </div>
                {person.phone && (
                  <ul className="contact-list contact-nested">
                    <ContactRow
                      icon="phone"
                      label={person.phone}
                      href={toTelHref(person.phone)}
                      copied={copied}
                      onCopy={copy}
                    />
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {loosePhones.length > 0 && (
        <div className="contact-group">
          <h3 className="contact-subtitle">Telefon</h3>
          <ul className="contact-list">
            {loosePhones.map((phone) => (
              <ContactRow key={phone} icon="phone" label={phone} href={toTelHref(phone)} copied={copied} onCopy={copy} />
            ))}
          </ul>
        </div>
      )}

      {contact.emails.length > 0 && (
        <div className="contact-group">
          <h3 className="contact-subtitle">E-Mail</h3>
          <ul className="contact-list">
            {contact.emails.map((email) => (
              <ContactRow key={email} icon="mail" label={email} href={`mailto:${email}`} copied={copied} onCopy={copy} />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
