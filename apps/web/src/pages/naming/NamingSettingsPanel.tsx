import { useState } from "react";
import { Modal } from "../../components/Modal";
import { PanelSkeleton } from "../../components/ui/PanelSkeleton";
import { NamingActionsBar } from "./NamingActionsBar";
import { NamingCorePanel } from "./NamingCorePanel";
import { NamingFieldMapsPanel } from "./NamingFieldMapsPanel";
import { NamingSuffixSection } from "./NamingSuffixSection";
import { NamingSyntaxDoc } from "./NamingSyntaxDoc";
import { NamingSyntaxTeaser } from "./NamingSyntaxTeaser";
import { NamingTestModal } from "./NamingTestModal";
import { useNamingConfig } from "./hooks/useNamingConfig";
import { useNamingImportExport } from "./hooks/useNamingImportExport";
import { useNamingPreview } from "./hooks/useNamingPreview";
import type { Props } from "./types";

export type { NamingSaveActions } from "./types";

export function NamingSettingsPanel(props: Props) {
  const { notify } = props;
  const {
    config,
    naming,
    loading,
    refreshing,
    saving,
    dirty,
    embedded,
    commit,
    patchNaming,
    save,
  } = useNamingConfig(props);
  const preview = useNamingPreview(naming, notify);
  const { fileImportRef, exportNaming, importNaming } = useNamingImportExport(
    config,
    patchNaming,
    commit,
    notify,
  );
  const [syntaxOpen, setSyntaxOpen] = useState(false);

  if (loading && !config) {
    return <PanelSkeleton label="加载命名配置…" lines={6} />;
  }

  if (!config || !naming) {
    return <PanelSkeleton label="命名配置不可用" lines={4} />;
  }

  return (
    <div className={`naming-settings${refreshing ? " is-refreshing" : ""}`}>
      <div className="naming-main">
        <NamingSyntaxTeaser onOpen={() => setSyntaxOpen(true)} />
        <NamingCorePanel naming={naming} patchNaming={patchNaming} notify={notify} />
        <NamingFieldMapsPanel naming={naming} patchNaming={patchNaming} />
        <NamingSuffixSection
          naming={naming}
          config={config}
          patchNaming={patchNaming}
          commit={commit}
          notify={notify}
        />
        <NamingActionsBar
          embedded={embedded}
          saving={saving}
          dirty={dirty}
          fileImportRef={fileImportRef}
          onExport={exportNaming}
          onImport={importNaming}
          onTest={() => preview.setTestOpen(true)}
          onSave={save}
        />
      </div>

      <Modal
        open={syntaxOpen}
        title="模板语法"
        wide
        onClose={() => setSyntaxOpen(false)}
        footer={
          <button type="button" className="btn primary" onClick={() => setSyntaxOpen(false)}>
            知道了
          </button>
        }
      >
        <NamingSyntaxDoc />
      </Modal>

      <NamingTestModal
        open={preview.testOpen}
        onClose={() => preview.setTestOpen(false)}
        testCode={preview.testCode}
        setTestCode={preview.setTestCode}
        testMosaic={preview.testMosaic}
        setTestMosaic={preview.setTestMosaic}
        testHasSub={preview.testHasSub}
        setTestHasSub={preview.setTestHasSub}
        testResolution={preview.testResolution}
        setTestResolution={preview.setTestResolution}
        preview={preview.preview}
        runPreview={preview.runPreview}
      />
    </div>
  );
}
