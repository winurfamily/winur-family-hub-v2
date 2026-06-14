"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BelanjaManualForm } from "./belanja-manual-form";
import { BelanjaScan } from "./belanja-scan";
import { BelanjaRencana } from "./belanja-rencana";
import { BelanjaRiwayat } from "./belanja-riwayat";
import { BelanjaSaldoSummary } from "./belanja-saldo-summary";
import type { PocketSummary, ShoppingPlanWithItems, ShoppingHistoryResult } from "@/app/actions/keuangan";

export function BelanjaTabs({
  pockets,
  plans,
  historyMonth,
  historyData,
}: {
  pockets: PocketSummary[];
  plans: ShoppingPlanWithItems[];
  historyMonth: string;
  historyData: ShoppingHistoryResult;
}) {
  return (
    <Tabs defaultValue="manual" className="space-y-4">
      <BelanjaSaldoSummary pockets={pockets} />
      <TabsList className="grid grid-cols-4 gap-2 h-auto bg-transparent p-0">
        <TabsTrigger
          value="manual"
          className="rounded-2xl px-3 py-2 font-heading text-sm font-extrabold border-2 bg-card text-ink-2 border-border data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary-dark data-[state=active]:shadow-btn-primary"
        >
          Manual
        </TabsTrigger>
        <TabsTrigger
          value="scan"
          className="rounded-2xl px-3 py-2 font-heading text-sm font-extrabold border-2 bg-card text-ink-2 border-border data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary-dark data-[state=active]:shadow-btn-primary"
        >
          Scan AI
        </TabsTrigger>
        <TabsTrigger
          value="rencana"
          className="rounded-2xl px-3 py-2 font-heading text-sm font-extrabold border-2 bg-card text-ink-2 border-border data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary-dark data-[state=active]:shadow-btn-primary"
        >
          Rencana
        </TabsTrigger>
        <TabsTrigger
          value="riwayat"
          className="rounded-2xl px-3 py-2 font-heading text-sm font-extrabold border-2 bg-card text-ink-2 border-border data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary-dark data-[state=active]:shadow-btn-primary"
        >
          Riwayat
        </TabsTrigger>
      </TabsList>

      <TabsContent value="manual">
        <BelanjaManualForm pockets={pockets} />
      </TabsContent>
      <TabsContent value="scan">
        <BelanjaScan pockets={pockets} />
      </TabsContent>
      <TabsContent value="rencana">
        <BelanjaRencana plans={plans} pockets={pockets} />
      </TabsContent>
      <TabsContent value="riwayat">
        <BelanjaRiwayat initialMonth={historyMonth} initialData={historyData} />
      </TabsContent>
    </Tabs>
  );
}
