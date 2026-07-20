"use client";

import { ExternalLink, MapPin } from "lucide-react";
import { wedding } from "@/data/wedding";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { useInvite } from "@/lib/invite-context";

export function Venue() {
  const invite = useInvite();
  const { venue } = wedding;
  const subtitle =
    invite?.invite.venueSubtitle ||
    "Maple Garden (A Unit of Sukhmani Resort), Buria Road, Jagadhri";

  return (
    <section id="venue" className="section-pad relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(ellipse_at_right,rgba(212,175,55,0.08),transparent_70%)]"
      />

      <div className="relative mx-auto max-w-6xl">
        <SectionHeading
          eyebrow="Location"
          title="The Venue"
          subtitle={subtitle}
        />

        {invite?.tier === "mehfil" ? (
          <div className="mb-8 grid gap-4 sm:grid-cols-2">
            <GlassCard glow>
              <p className="font-body text-[10px] uppercase tracking-[0.3em] text-gold/70">
                9th August
              </p>
              <h3 className="mt-2 font-display text-2xl text-cream">Panipat</h3>
              <p className="mt-2 font-body text-sm text-muted">
                Sukhmani Sahib Path · Mehndi · Jaggo · Sangeet
              </p>
              <a
                href="https://www.google.com/maps/search/?api=1&query=Panipat%20Haryana"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-2 font-body text-xs uppercase tracking-[0.18em] text-gold-soft hover:underline"
              >
                Get directions <ExternalLink size={12} />
              </a>
            </GlassCard>
            <GlassCard glow>
              <p className="font-body text-[10px] uppercase tracking-[0.3em] text-gold/70">
                12th & 13th August
              </p>
              <h3 className="mt-2 font-display text-2xl text-cream">
                {venue.name}
              </h3>
              <p className="mt-2 font-body text-sm text-muted">
                Haldi · Chooda · Bharaat · Anand Karaj · Doli
              </p>
              <p className="mt-1 font-body text-xs text-muted/80">
                {venue.fullAddress}
              </p>
            </GlassCard>
          </div>
        ) : null}

        <div className="grid items-stretch gap-6 lg:grid-cols-2">
          <GlassCard glow className="flex flex-col justify-between">
            <div>
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full border border-gold/30 bg-gold/10 text-gold">
                <MapPin size={20} aria-hidden />
              </div>
              <h3 className="font-display text-3xl text-cream">{venue.name}</h3>
              <p className="mt-2 font-body text-sm uppercase tracking-[0.2em] text-gold-soft">
                {venue.detail}
              </p>
              <p className="mt-6 font-body text-base leading-relaxed text-muted">
                {venue.address}
              </p>
              <p className="mt-2 font-body text-sm text-muted/80">
                {venue.fullAddress}
              </p>
            </div>

            <div className="mt-8">
              <a
                href={venue.mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button type="button" className="w-full sm:w-auto">
                  Get Directions
                  <ExternalLink size={14} aria-hidden />
                </Button>
              </a>
            </div>
          </GlassCard>

          <GlassCard className="overflow-hidden p-2 md:p-3">
            <div className="relative aspect-[4/3] overflow-hidden rounded-xl">
              <iframe
                title={`Map showing ${venue.name}`}
                src={venue.embedUrl}
                className="absolute inset-0 h-full w-full border-0 grayscale-[30%] contrast-125 saturate-50"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                allowFullScreen
              />
              <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-gold/20" />
            </div>
          </GlassCard>
        </div>
      </div>
    </section>
  );
}
