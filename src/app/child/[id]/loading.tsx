import { Skeleton } from "@/components/ui/skeleton";
import { WidgetPanel } from "@/components/child/layout/widget-panel";
import { DashboardGrid, DashboardMain, DashboardAside } from "@/components/child/layout/dashboard-grid";

export default function ChildLoading() {
  return (
    <div className="flex flex-col gap-4 lg:gap-6">
      <WidgetPanel className="p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:gap-8">
          <Skeleton className="mx-auto h-24 w-24 shrink-0 rounded-full lg:mx-0" />
          <div className="flex-1">
            <Skeleton className="mx-auto h-5 w-32 rounded-lg lg:mx-0" />
            <Skeleton className="mx-auto mt-3 h-3 w-full rounded-full lg:mx-0" />
            <Skeleton className="mx-auto mt-4 h-3 w-2/3 rounded-full lg:mx-0" />
          </div>
          <div className="grid shrink-0 grid-cols-2 gap-2 sm:gap-3 lg:w-64">
            <Skeleton className="h-16 rounded-2xl sm:rounded-3xl" />
            <Skeleton className="h-16 rounded-2xl sm:rounded-3xl" />
          </div>
        </div>
      </WidgetPanel>

      <DashboardGrid>
        <DashboardAside className="order-1 flex flex-col gap-4 lg:order-2 lg:gap-6">
          <Skeleton className="h-32 w-full rounded-2xl sm:rounded-3xl" />
          <Skeleton className="h-40 w-full rounded-2xl sm:rounded-3xl" />
        </DashboardAside>

        <DashboardMain className="order-2 lg:order-1">
          <WidgetPanel className="p-4 sm:p-5 lg:p-6">
            <Skeleton className="mb-3 h-5 w-32 rounded-lg" />
            <div className="flex gap-3 overflow-x-auto pb-1">
              <Skeleton className="h-40 w-[150px] shrink-0 rounded-2xl sm:w-40" />
              <Skeleton className="h-40 w-[150px] shrink-0 rounded-2xl sm:w-40" />
              <Skeleton className="h-40 w-[150px] shrink-0 rounded-2xl sm:w-40" />
              <Skeleton className="h-40 w-[150px] shrink-0 rounded-2xl sm:w-40" />
            </div>
          </WidgetPanel>
        </DashboardMain>
      </DashboardGrid>
    </div>
  );
}
