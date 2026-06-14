"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BelanjaManualForm } from "./belanja-manual-form";
import { BelanjaScan } from "./belanja-scan";
import { BelanjaRencana } from "./belanja-rencana";
import { BelanjaRiwayat } from "./belanja-riwayat";
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
      <TabsList className="grid grid-cols-4">
        <TabsTrigger value="manual">Manual</TabsTrigger>
        <TabsTrigger value="scan">Scan AI</TabsTrigger>
        <TabsTrigger value="rencana">Rencana</TabsTrigger>
        <TabsTrigger value="riwayat">Riwayat</TabsTrigger>
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
