import React from 'react';
import {
  ArrowRight,
  Bell,
  Building2,
  Calendar,
  Download,
  FileText,
  Globe,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Video,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { PWAInstallButton } from '../components/UiPrimitives';

interface HomePageProps {
  onOpenLogin: () => void;
}

export const HomePage: React.FC<HomePageProps> = ({ onOpenLogin }) => {
  const { lang, setLang, tr, isOnline, publicData } = useApp();
  const s = publicData.settings;
  const notices = publicData.notices || [];
  const media = publicData.media || [];

  const photos = media.filter((m) => m.mediaType === 'Image' || m.mediaType === 'Photo');
  const videos = media.filter((m) => m.mediaType === 'Video');
  const documents = media.filter((m) => m.mediaType === 'PDF' || m.mediaType === 'Document');

  const societyTitle = lang === 'as' && s?.societyNameAs ? s.societyNameAs : s?.societyName || tr('orgFullName');
  const heroTitle = lang === 'as' && s?.homepageHeroTitleAs ? s.homepageHeroTitleAs : s?.homepageHeroTitle || societyTitle;
  const heroSubtitle =
    lang === 'as' && s?.homepageHeroSubtitleAs
      ? s.homepageHeroSubtitleAs
      : s?.homepageHeroSubtitle || 'Transparent Cooperative Savings, Member Credit, and Community Prosperity — Accessible Online and Offline.';
  const introText =
    lang === 'as' && s?.homepageIntroAs
      ? s.homepageIntroAs
      : s?.homepageIntro ||
        'Garakhia Dhap Multipurpose Co-operative Society Ltd. empowers members through disciplined monthly savings, community share capital, and transparent credit.';
  const tickerText =
    lang === 'as' && s?.announcementTickerAs
      ? s.announcementTickerAs
      : s?.announcementTicker || '';

  return (
    <div className="min-h-screen bg-[#F4F7F6] dark:bg-[#0B1320] text-[#1D2939] dark:text-slate-100">
      {/* Top Bar Contract: 3 clean zones separated by gap-8 */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
          <a href="#top" className="flex items-center gap-2.5 text-lg font-bold tracking-tight text-[#142D4E] dark:text-white whitespace-nowrap shrink-0">
            <img
              src={s?.logoUrl || '/icon.svg'}
              alt="GMCSL Logo"
              referrerPolicy="no-referrer"
              className="w-8 h-8 rounded-lg object-contain"
            />
            <span className="font-display">GMCSL</span>
          </a>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-[#667085] dark:text-slate-300">
            <a href="#about" className="hover:text-[#087443] dark:hover:text-emerald-400 transition-colors whitespace-nowrap shrink-0">
              {tr('navAbout')}
            </a>
            <a href="#notices" className="hover:text-[#087443] dark:hover:text-emerald-400 transition-colors whitespace-nowrap shrink-0">
              {tr('navNotices')}
            </a>
            <a href="#gallery" className="hover:text-[#087443] dark:hover:text-emerald-400 transition-colors whitespace-nowrap shrink-0">
              {tr('navGallery')}
            </a>
            <a href="#documents" className="hover:text-[#087443] dark:hover:text-emerald-400 transition-colors whitespace-nowrap shrink-0">
              {tr('importantDocuments')}
            </a>
            <a href="#contact" className="hover:text-[#087443] dark:hover:text-emerald-400 transition-colors whitespace-nowrap shrink-0">
              {tr('navContact')}
            </a>
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={onOpenLogin}
              className="px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-[#087443] rounded-lg hover:bg-[#065c35] transition-colors whitespace-nowrap shrink-0"
            >
              {tr('loginNow')}
            </button>
          </div>
        </div>
      </header>

      {/* Workspace Utility Bar below header: Bilingual Switcher + Online/Offline Status + PWA Install */}
      <div className="bg-[#142D4E] text-white border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-4 min-w-0">
            <span className="inline-flex items-center gap-1.5 font-medium whitespace-nowrap">
              {isOnline ? <Wifi className="w-3.5 h-3.5 text-emerald-400" /> : <WifiOff className="w-3.5 h-3.5 text-amber-400" />}
              <span>{isOnline ? tr('onlineMode') : tr('offlineMode')}</span>
            </span>
            {tickerText && (
              <>
                <span className="text-white/30" aria-hidden="true">|</span>
                <p className="truncate text-slate-200">{tickerText}</p>
              </>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setLang(lang === 'en' ? 'as' : 'en')}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-white/10 hover:bg-white/20 text-white font-medium transition-colors whitespace-nowrap"
            >
              <Globe className="w-3.5 h-3.5 text-[#D5A642]" />
              <span>{lang === 'en' ? 'অসমীয়া' : 'English'}</span>
            </button>
            <PWAInstallButton compact />
          </div>
        </div>
      </div>

      {/* Hero Section */}
      <section id="top" className="max-w-7xl mx-auto px-4 sm:px-6 py-10 lg:py-14">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          <div className="lg:col-span-6 flex flex-col justify-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-10">
            <div className="text-xs font-semibold text-[#087443] dark:text-emerald-400 tracking-wide mb-3">
              {s?.address ? (lang === 'as' && s.addressAs ? s.addressAs : s.address) : 'Garakhia Dhap, Assam'}
              {s?.registrationDetails ? ` · ${s.registrationDetails}` : ''}
            </div>
            <h1 className="font-display text-3xl sm:text-4xl font-bold text-[#142D4E] dark:text-white leading-tight [text-wrap:balance]">
              {heroTitle}
            </h1>
            <p className="mt-4 text-base text-[#667085] dark:text-slate-300 leading-relaxed max-w-xl">
              {heroSubtitle}
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <button
                onClick={onOpenLogin}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-[#087443] hover:bg-[#065c35] text-white font-semibold text-sm transition-colors whitespace-nowrap"
              >
                <span>{tr('loginNow')}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <a
                href="#notices"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-lg border border-slate-300 dark:border-slate-700 text-[#1D2939] dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold text-sm transition-colors whitespace-nowrap"
              >
                <Bell className="w-4 h-4 text-[#D5A642]" />
                <span>{tr('heroExplore')}</span>
              </a>
            </div>
            <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 grid grid-cols-3 gap-4 text-xs">
              <div>
                <p className="font-semibold text-[#142D4E] dark:text-white">Dual Mode</p>
                <p className="text-[#667085] dark:text-slate-400 mt-0.5">Online & Offline Sync</p>
              </div>
              <div>
                <p className="font-semibold text-[#142D4E] dark:text-white">4 Role Portals</p>
                <p className="text-[#667085] dark:text-slate-400 mt-0.5">System, President, Sec, Member</p>
              </div>
              <div>
                <p className="font-semibold text-[#142D4E] dark:text-white">Bilingual</p>
                <p className="text-[#667085] dark:text-slate-400 mt-0.5">Assamese & English</p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-6 relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 min-h-[300px] bg-[#142D4E]">
            <img
              src="/src/assets/images/gmcsl_hero_cooperative_1794661071710.jpg"
              alt="Garakhia Dhap Multipurpose Co-operative Society Ltd."
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#142D4E]/80 via-[#142D4E]/20 to-transparent flex items-end p-6">
              <div className="text-white">
                <p className="text-xs font-medium text-[#D5A642]">{tr('shortName')}</p>
                <p className="text-base sm:text-lg font-semibold mt-0.5">{societyTitle}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* About Society + Important Notices */}
      <section id="about" className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8">
            <div className="flex items-center gap-2 text-[#087443] dark:text-emerald-400 text-xs font-semibold mb-2">
              <Building2 className="w-4 h-4" />
              <span>{tr('navAbout')}</span>
            </div>
            <h2 className="font-display text-2xl font-bold text-[#142D4E] dark:text-white">
              {societyTitle}
            </h2>
            <p className="mt-3 text-sm text-[#667085] dark:text-slate-300 leading-relaxed">
              {introText}
            </p>
            <div className="mt-6 space-y-3 text-sm border-t border-slate-100 dark:border-slate-800 pt-5">
              <div className="flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-[#087443] shrink-0 mt-0.5" />
                <span>Role-based member financial isolation & tamper-evident audit logging.</span>
              </div>
              <div className="flex items-start gap-2.5">
                <Calendar className="w-4 h-4 text-[#087443] shrink-0 mt-0.5" />
                <span>Financial Year: {s?.financialYear || '2026-2027'}</span>
              </div>
            </div>
          </div>

          <div id="notices" className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8">
            <div className="flex items-center justify-between gap-4 mb-5">
              <h2 className="font-display text-2xl font-bold text-[#142D4E] dark:text-white">
                {tr('importantNotices')}
              </h2>
              <span className="text-xs text-[#667085] dark:text-slate-400">{notices.length} Published</span>
            </div>
            {notices.length === 0 ? (
              <div className="py-10 text-center border border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                <p className="text-sm font-medium text-[#1D2939] dark:text-slate-200">No public notices published yet.</p>
                <p className="text-xs text-[#667085] dark:text-slate-400 mt-1">
                  Authorized society officers can publish notices from the Notice Board module.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {notices.slice(0, 5).map((n) => (
                  <article key={n.noticeId} className="py-4 first:pt-0 last:pb-0">
                    <div className="flex items-center gap-2 text-xs text-[#667085] dark:text-slate-400">
                      <span className="font-semibold text-[#087443] dark:text-emerald-400">{n.category}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono-tabular">{n.publishDate}</span>
                    </div>
                    <h3 className="mt-1 text-base font-semibold text-[#1D2939] dark:text-white">
                      {lang === 'as' && n.titleAs ? n.titleAs : n.title}
                    </h3>
                    <p className="mt-1 text-sm text-[#667085] dark:text-slate-300 leading-relaxed">
                      {lang === 'as' && n.contentAs ? n.contentAs : n.content}
                    </p>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Photo & Video Gallery */}
      {(s?.showPhotoGallery !== false || s?.showVideoGallery !== false) && (
        <section id="gallery" className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-display text-2xl font-bold text-[#142D4E] dark:text-white">{tr('photoGallery')}</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
              <div className="aspect-[4/3] bg-slate-100 dark:bg-slate-800">
                <img
                  src="/src/assets/images/gmcsl_community_meeting_1794661071628.jpg"
                  alt="Society Annual General Meeting"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-4">
                <h3 className="text-sm font-semibold text-[#1D2939] dark:text-white">General Assembly & Member Review</h3>
                <p className="text-xs text-[#667085] dark:text-slate-400 mt-1">Transparent community ledger review and cooperative governance.</p>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
              <div className="aspect-[4/3] bg-slate-100 dark:bg-slate-800">
                <img
                  src="/src/assets/images/gmcsl_agriculture_empowerment_1794661073032.jpg"
                  alt="Assam Rural Agriculture Empowerment"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-4">
                <h3 className="text-sm font-semibold text-[#1D2939] dark:text-white">Agricultural & Rural Livelihood Support</h3>
                <p className="text-xs text-[#667085] dark:text-slate-400 mt-1">Cooperative credit supporting Assam farmers and local enterprises.</p>
              </div>
            </div>

            {photos.slice(0, 4).map((p) => (
              <div key={p.mediaId} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                <div className="aspect-[4/3] bg-slate-100 dark:bg-slate-800">
                  <img
                    src={p.dataUrl}
                    alt={p.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-4">
                  <h3 className="text-sm font-semibold text-[#1D2939] dark:text-white">
                    {lang === 'as' && p.titleAs ? p.titleAs : p.title}
                  </h3>
                  {p.description && <p className="text-xs text-[#667085] dark:text-slate-400 mt-1">{p.description}</p>}
                </div>
              </div>
            ))}

            {videos.map((v) => (
              <div key={v.mediaId} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                <div className="aspect-[4/3] bg-slate-900 flex items-center justify-center">
                  <video src={v.dataUrl} controls className="w-full h-full object-cover" />
                </div>
                <div className="p-4 flex items-center gap-2">
                  <Video className="w-4 h-4 text-[#087443] shrink-0" />
                  <h3 className="text-sm font-semibold text-[#1D2939] dark:text-white truncate">{v.title}</h3>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Important Documents */}
      {s?.showDocumentsSection !== false && (
        <section id="documents" className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8">
            <h2 className="font-display text-xl font-bold text-[#142D4E] dark:text-white mb-4">
              {tr('importantDocuments')}
            </h2>
            {documents.length === 0 ? (
              <p className="text-sm text-[#667085] dark:text-slate-400">
                Official public circulars and downloadable PDF documents published via Media Manager will appear here.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {documents.map((doc) => (
                  <a
                    key={doc.mediaId}
                    href={doc.dataUrl}
                    download={doc.fileName}
                    className="flex items-center justify-between gap-3 p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-[#087443] transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <FileText className="w-5 h-5 text-[#087443] shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{doc.title}</p>
                        <p className="text-xs text-[#667085] dark:text-slate-400">{doc.mediaType}</p>
                      </div>
                    </div>
                    <Download className="w-4 h-4 text-slate-400 shrink-0" />
                  </a>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Contact & Footer */}
      <footer id="contact" className="mt-10 bg-[#142D4E] text-white border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <div className="flex items-center gap-2.5 font-display text-lg font-bold">
              <img src={s?.logoUrl || '/icon.svg'} alt="GMCSL" className="w-7 h-7 rounded" />
              <span>GMCSL</span>
            </div>
            <p className="mt-2 text-sm text-slate-300 leading-relaxed">{societyTitle}</p>
            {s?.registrationDetails && (
              <p className="mt-1 text-xs text-[#D5A642]">{s.registrationDetails}</p>
            )}
          </div>

          <div className="space-y-2 text-sm text-slate-300">
            <h3 className="font-semibold text-white mb-2">{tr('contactInformation')}</h3>
            <p className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-[#D5A642] shrink-0" />
              <span>{lang === 'as' && s?.addressAs ? s.addressAs : s?.address || 'Garakhia Dhap, Assam'}</span>
            </p>
            {s?.contactPhone && (
              <p className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-[#D5A642] shrink-0" />
                <span className="font-mono-tabular">{s.contactPhone}</span>
              </p>
            )}
            {s?.officialEmail && (
              <p className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-[#D5A642] shrink-0" />
                <span>{s.officialEmail}</span>
              </p>
            )}
          </div>

          <div className="flex flex-col items-start md:items-end justify-between gap-4">
            <button
              onClick={onOpenLogin}
              className="px-5 py-2.5 rounded-lg bg-[#087443] hover:bg-[#065c35] text-white text-sm font-semibold transition-colors"
            >
              {tr('loginNow')}
            </button>
            <p className="text-xs text-slate-400">
              © {new Date().getFullYear()} {s?.shortName || 'GMCSL'}. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};
