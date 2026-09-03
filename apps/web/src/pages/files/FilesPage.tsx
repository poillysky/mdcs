import { CreateJobModal } from "../../components/CreateJobModal";
import { EmptyState } from "../../components/ui/EmptyState";
import { FilesActionBar } from "./FilesActionBar";
import { FilesBrowserPanel } from "./FilesBrowserPanel";
import { FilesPageHeader } from "./FilesPageHeader";
import { useFilesPage } from "./hooks/useFilesPage";
import { indexableKindIds, type FilesPageProps } from "./types";

export function FilesPage({ kinds, loading, onChanged, onNavigate, notify }: FilesPageProps) {
  const m = useFilesPage({ kinds, onChanged, notify });

  return (
    <div className="files-page">
      <FilesPageHeader />

      {!kinds.length ? (
        <EmptyState title="暂无分区" description="请先在设置中配置七路径分区。" />
      ) : (
        <>
          <FilesActionBar
            kind={m.kind}
            inScope={m.inKindScope}
            browsePath={m.browsePath}
            selectedCount={m.selectedCount}
            indexingAll={m.indexingAll}
            indexingSubmitting={m.indexingSubmitting}
            indexStatus={m.indexStatus}
            scrapingAll={m.scrapingAll}
            scrapeEnabled={m.scrapeEnabled}
            indexableCount={indexableKindIds(kinds).length}
            loading={loading}
            onIndexAll={() => void m.indexAllLocal()}
            onScrapeAll={() => void m.scrapeAllInScope()}
          />

          <FilesBrowserPanel
            crumbs={m.crumbs}
            treeLoading={m.treeLoading}
            filteredFolders={m.treeFolders}
            selectedPaths={m.selectedPaths}
            allVisibleSelected={m.allVisibleSelected}
            kinds={kinds}
            browseFiles={m.browseFiles}
            pagedBrowseFiles={m.pagedBrowseFiles}
            treeFiles={m.treeFiles}
            filePage={m.filePage}
            filePages={m.filePages}
            fileStatus={m.fileStatus}
            filesLoading={m.filesLoading}
            scrapeEnabled={m.scrapeEnabled}
            scrapingId={m.scrapingId}
            inScope={m.inKindScope}
            browsePath={m.browsePath}
            onGoCrumb={m.goCrumb}
            onNavigate={(rel) => m.navigateToPath(rel)}
            onToggleSelect={m.toggleFolderSelect}
            onToggleSelectAll={m.toggleSelectAllVisible}
            onCreateJob={(rel) => m.openCreateJob(rel)}
            onFileStatus={(status) => {
              m.setFileStatus(status);
              m.setFilePage(1);
            }}
            onFilePage={m.setFilePage}
            onScrape={(file) => void m.scrapeFileRow(file)}
            onOpenDetail={(id) => onNavigate(`/records?id=${id}`)}
          />
          <CreateJobModal
            open={m.createOpen}
            kinds={kinds}
            loading={loading}
            defaultMode="full"
            defaultKindIds={m.createJobContext.kindIds}
            contextFolder={m.createJobContext.folder}
            onClose={m.closeCreateJob}
            onCreated={m.handleJobCreated}
            notify={notify}
          />
        </>
      )}
    </div>
  );
}
