'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Lightbulb, ChevronLeft, ChevronRight } from 'lucide-react';
import { getStoredProfile } from '@/lib/data-service';

interface HealthInsight {
  condition: string;
  fact: string;
  tip: string;
}

const DEFAULT_INSIGHTS: HealthInsight[] = [
  {
    condition: 'Insulin Resistance',
    fact: 'Insulin resistance often develops 5-10 years before blood sugar spikes on standard lab tests. Muscle is the largest glucose sponge in your body.',
    tip: 'Quick Action: A brisk 10-15 minute walk immediately after meals blunts glucose surges by up to 35%.',
  },
  {
    condition: 'Triglycerides',
    fact: 'Fasting triglycerides respond rapidly to refined carbohydrate and fructose reduction—often dropping 20-30% within just 3 to 4 weeks.',
    tip: 'Quick Action: Replace sugary beverages and late-night refined starches with omega-3 rich foods and soluble fiber.',
  },
  {
    condition: 'Prediabetes',
    fact: 'HbA1c reflects your 90-day red blood cell glycation average, meaning consistent daily meal sequencing directly reshapes your next quarterly lab report.',
    tip: 'Quick Action: Eat fiber and protein 10 minutes before starches to flatten post-meal insulin demand.',
  },
  {
    condition: 'Hypertension',
    fact: 'Vascular endothelial stiffness is closely linked to metabolic insulin sensitivity and sodium-potassium balance across daily hydration.',
    tip: 'Quick Action: Pair consistent morning hydration with potassium-rich leafy greens and 5 minutes of slow nasal breathing.',
  },
  {
    condition: 'Cholesterol',
    fact: 'The Triglyceride-to-HDL ratio is one of the strongest functional predictors of LDL particle size and cardiovascular metabolic resilience.',
    tip: 'Quick Action: Prioritize soluble fiber (oats, chia, legumes) and extra-virgin olive oil to support healthy HDL transport.',
  },
  {
    condition: 'Kidney Stones',
    fact: 'Uric acid and calcium oxalate crystallization risk drops significantly when urinary citrate rises and 24-hour hydration stays consistent.',
    tip: 'Quick Action: Add fresh lemon juice to water daily and aim for pale, well-diluted hydration throughout the afternoon.',
  },
];

export default function LiveHealthBanner() {
  const [insights, setInsights] = useState<HealthInsight[]>(DEFAULT_INSIGHTS);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const syncUserConditions = useCallback(async () => {
    const profile = await getStoredProfile();
    if (profile && Array.isArray(profile.conditions) && profile.conditions.length > 0) {
      const lowerConds = profile.conditions.map((c) => c.toLowerCase());
      const matched = DEFAULT_INSIGHTS.filter((item) =>
        lowerConds.some(
          (c) =>
            item.condition.toLowerCase().includes(c) ||
            c.includes(item.condition.toLowerCase())
        )
      );
      const unmatched = DEFAULT_INSIGHTS.filter((item) => !matched.includes(item));
      setInsights([...matched, ...unmatched]);
    } else {
      setInsights(DEFAULT_INSIGHTS);
    }
  }, []);

  useEffect(() => {
    syncUserConditions();
    window.addEventListener('medtrac-profile-updated', syncUserConditions);
    return () => {
      window.removeEventListener('medtrac-profile-updated', syncUserConditions);
    };
  }, [syncUserConditions]);

  const handleNext = useCallback(() => {
    setIsTransitioning(true);
    setTimeout(() => {
      setActiveIndex((prev) => (prev + 1) % insights.length);
      setIsTransitioning(false);
    }, 140);
  }, [insights.length]);

  const handlePrev = useCallback(() => {
    setIsTransitioning(true);
    setTimeout(() => {
      setActiveIndex((prev) => (prev - 1 + insights.length) % insights.length);
      setIsTransitioning(false);
    }, 140);
  }, [insights.length]);

  // 4-second smart cycling feed
  useEffect(() => {
    const timer = setInterval(() => {
      handleNext();
    }, 4000);
    return () => clearInterval(timer);
  }, [handleNext]);

  const current = insights[activeIndex] || DEFAULT_INSIGHTS[0];

  return (
    <div className="no-print w-full rounded-[24px] bg-gradient-to-r from-[#13296e] via-[#173182] to-[#112462] border border-[#2d53b8]/60 shadow-[0_8px_28px_rgba(17,36,98,0.2)] px-5 py-4 sm:px-6 sm:py-5 text-white transition-all">
      {/* Top Row: Live Health Intelligence Badge + Pagination Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#1a398c]/90 border border-[#3c69dc]/75 text-[#58c4ff] text-xs font-extrabold tracking-tight shadow-2xs">
            <Lightbulb className="w-3.5 h-3.5 text-[#58c4ff] stroke-[2.2]" />
            <span>Live Health Intelligence</span>
          </span>
          <span className="text-[11px] sm:text-xs text-blue-200/80 font-medium">
            (4-second smart cycling feed)
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrev}
            className="p-1 rounded-lg text-blue-200 hover:text-white hover:bg-white/10 transition tap-press"
            aria-label="Previous insight"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-1.5">
            {insights.map((_, idx) => {
              const isActive = idx === activeIndex;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActiveIndex(idx)}
                  aria-label={`Insight ${idx + 1}`}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    isActive
                      ? 'w-6 bg-[#00c4ff] shadow-[0_0_8px_rgba(0,196,255,0.6)]'
                      : 'w-2 bg-[#2563eb] hover:bg-[#3b82f6]'
                  }`}
                />
              );
            })}
          </div>

          <button
            type="button"
            onClick={handleNext}
            className="p-1 rounded-lg text-blue-200 hover:text-white hover:bg-white/10 transition tap-press"
            aria-label="Next insight"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Insight Content with Smooth Transition */}
      <div
        className={`space-y-2 transition-all duration-200 ${
          isTransitioning ? 'opacity-40 translate-y-0.5' : 'opacity-100 translate-y-0'
        }`}
      >
        <p className="text-sm sm:text-base font-extrabold text-white leading-snug tracking-tight">
          {current.fact}
        </p>
        <p className="text-xs sm:text-[13px] font-medium text-blue-100/95 leading-relaxed">
          <span className="text-[#38bdf8] font-extrabold">Actionable Tip:</span>{' '}
          <span>{current.tip}</span>
        </p>
      </div>
    </div>
  );
}
