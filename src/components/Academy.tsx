import { useMemo, useState } from 'react';
import {
  Clock,
  Dumbbell,
  Layers,
  Lightbulb,
  Moon,
  RotateCcw,
  Scale,
  Search,
  ChevronDown,
  TrendingUp,
  UtensilsCrossed,
  ExternalLink,
} from 'lucide-react';
import { EVIDENCE_LABELS, GUIDE_ARTICLES, type EvidenceLevel, type GuideArticle, type GuideCategory } from '../data/guideArticles';

/** Renders "**bold**" segments as <strong>, everything else as plain text. */
function renderFormattedText(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? (
      <strong key={i} className="font-bold text-zinc-800 dark:text-zinc-200">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

type ArticleCategory = GuideCategory;

const CATEGORY_LABELS: Record<ArticleCategory, string> = {
  nutrition: 'תזונה ומאקרו',
  training: 'עקרונות אימון',
  recovery: 'התאוששות ושינה',
  progress: 'מעקב התקדמות',
};

const ARTICLE_ICONS: Record<string, typeof Scale> = {
  'morning-weigh-in': Scale,
  'food-scale': UtensilsCrossed,
  'protein-target': Dumbbell,
  'progressive-overload': TrendingUp,
  'weekly-volume': Layers,
  'rest-times': Clock,
  'sleep-recovery': Moon,
  'deload-week': RotateCcw,
  'measurements-vs-scale': TrendingUp,
  'bulk-cut-recomp': Lightbulb,
};

const EVIDENCE_STYLES: Record<EvidenceLevel, string> = {
  strong: 'border-lime-400/40 bg-lime-400/10 text-lime-700 dark:text-lime-400',
  moderate: 'border-sky-400/40 bg-sky-400/10 text-sky-700 dark:text-sky-300',
  limited: 'border-orange-400/40 bg-orange-400/10 text-orange-700 dark:text-orange-300',
  common: 'border-zinc-300 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-400',
};

const ARTICLES = GUIDE_ARTICLES;

const CATEGORY_FILTERS: { id: ArticleCategory | 'all'; label: string }[] = [
  { id: 'all', label: 'הכול' },
  { id: 'nutrition', label: CATEGORY_LABELS.nutrition },
  { id: 'training', label: CATEGORY_LABELS.training },
  { id: 'recovery', label: CATEGORY_LABELS.recovery },
  { id: 'progress', label: CATEGORY_LABELS.progress },
];

export default function Academy() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<ArticleCategory | 'all'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(ARTICLES[0].id);

  const filteredArticles = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ARTICLES.filter((article) => {
      if (category !== 'all' && article.category !== category) return false;
      if (!q) return true;
      return (
        article.title.toLowerCase().includes(q) ||
        article.summary.toLowerCase().includes(q) ||
        article.keywords.some((k) => k.toLowerCase().includes(q)) ||
        article.paragraphs.some((p) => p.toLowerCase().includes(q))
      );
    });
  }, [query, category]);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-extrabold text-zinc-900 dark:text-zinc-100">מדריכים</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-500">טיפים והסברים שיעזרו לך להבין את המספרים שמאחורי התוכנית</p>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute inset-y-0 right-3 flex h-full w-4 items-center text-zinc-600 dark:text-zinc-500" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="חיפוש לפי מילת מפתח, למשל: חלבון, נפח אימון, שינה..."
          className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 py-3 pe-10 ps-4 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 outline-none transition focus:border-lime-400 focus:ring-2 focus:ring-lime-400/20"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {CATEGORY_FILTERS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setCategory(id)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
              category === id
                ? 'border-lime-400/50 bg-lime-400/10 text-lime-700 dark:text-lime-400'
                : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {filteredArticles.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <p className="text-sm text-zinc-600 dark:text-zinc-500">לא נמצאו מדריכים התואמים לחיפוש</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filteredArticles.map((article) => {
            const isOpen = expandedId === article.id;
            const Icon = ARTICLE_ICONS[article.id] ?? Lightbulb;
            return (
              <div key={article.id} className="glass-card overflow-hidden">
                <button
                  type="button"
                  onClick={() => setExpandedId((id) => (id === article.id ? null : article.id))}
                  className="flex w-full items-start gap-3 p-4 text-right sm:p-5"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-lime-400/10 text-lime-700 dark:text-lime-400">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-lime-700 dark:text-lime-400/80">
                        {CATEGORY_LABELS[article.category]}
                      </p>
                      <span className={`rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${EVIDENCE_STYLES[article.evidence]}`}>{EVIDENCE_LABELS[article.evidence]}</span>
                    </div>
                    <p className="font-bold text-zinc-900 dark:text-zinc-100">{article.title}</p>
                    <p className="mt-0.5 text-xs leading-snug text-zinc-600 dark:text-zinc-500">{article.summary}</p>
                  </div>
                  <ChevronDown
                    className={`mt-2 h-4 w-4 shrink-0 text-zinc-600 dark:text-zinc-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                  />
                </button>

                {isOpen && (
                  <div className="flex flex-col gap-3 border-t border-zinc-200 dark:border-zinc-800 p-4 pt-4 animate-fade-in sm:p-5">
                    {article.paragraphs.map((paragraph) => (
                      <p key={paragraph.slice(0, 24)} className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                        {renderFormattedText(paragraph)}
                      </p>
                    ))}
                    <ArticleSources article={article} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <SourcesCard />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sources card
// ---------------------------------------------------------------------------

function ArticleSources({ article }: { article: GuideArticle }) {
  return (
    <div className="mt-1 rounded-xl border border-zinc-200 bg-zinc-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-900/50">
      <p className="mb-1.5 text-xs font-bold text-zinc-800 dark:text-zinc-200">מקורות · {EVIDENCE_LABELS[article.evidence]}</p>
      {article.sources.length === 0 ? (
        <p className="text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-500">
          אין כאן מחקר בודד שעומד מאחורי הטענה: זה ידע פיזיולוגי ופרקטי מקובל.
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {article.sources.map((source) => (
            <li key={source.label} className="text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-400">
              {source.url ? (
                <a href={source.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-start gap-1 underline decoration-dotted underline-offset-2 hover:text-lime-700 dark:hover:text-lime-400">
                  <ExternalLink className="mt-0.5 h-3 w-3 shrink-0" />
                  {source.label}
                </a>
              ) : (
                source.label
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SourcesCard() {
  return (
    <div className="glass-card p-4 sm:p-5">
      <h2 className="mb-2 text-sm font-bold text-zinc-900 dark:text-zinc-100">איך לקרוא את המדריכים</h2>
      <p className="mb-3 text-xs leading-relaxed text-zinc-600 dark:text-zinc-500">
        כל מדריך מציין את רמת הראיות שמאחוריו ואת המקורות. בתחום הזה יש גם ויכוחים ואי-ודאות, ובמקום שהמחקר חלש או סותר כתבנו זאת. המדריכים הם מידע
        כללי ולא ייעוץ רפואי או תזונתי אישי. לחיפוש מחקרים נוספים:
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <a
          href="https://pubmed.ncbi.nlm.nih.gov/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-1 items-center justify-between gap-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/60 px-3.5 py-2.5 text-sm font-semibold text-zinc-800 dark:text-zinc-200 transition hover:border-lime-400/50 hover:text-lime-700 dark:hover:text-lime-400"
        >
          PubMed
          <ExternalLink className="h-3.5 w-3.5 shrink-0" />
        </a>
        <a
          href="https://examine.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-1 items-center justify-between gap-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/60 px-3.5 py-2.5 text-sm font-semibold text-zinc-800 dark:text-zinc-200 transition hover:border-lime-400/50 hover:text-lime-700 dark:hover:text-lime-400"
        >
          Examine.com
          <ExternalLink className="h-3.5 w-3.5 shrink-0" />
        </a>
      </div>
    </div>
  );
}
