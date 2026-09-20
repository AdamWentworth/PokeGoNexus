import React from 'react';
import HeaderRow from './HeaderRow';
import BackgroundSelector from './BackgroundSelector';
import ImageStage from './ImageStage';
import IdentityRow from './IdentityRow';
import LevelGenderRow from './LevelGenderRow';
import StatsRow from './StatsRow';
import MovesAndIV from './MovesAndIV';
import MetaPanel from './MetaPanel';
import LevelArc from '../components/Caught/LevelArc';
import CaughtDateRibbon from './CaughtDateRibbon';

type HeaderRowSectionProps = React.ComponentProps<typeof HeaderRow>;
type BackgroundSelectorSectionProps = React.ComponentProps<typeof BackgroundSelector>;
type ImageStageSectionProps = React.ComponentProps<typeof ImageStage>;
type IdentityRowSectionProps = React.ComponentProps<typeof IdentityRow>;
type LevelGenderRowSectionProps = React.ComponentProps<typeof LevelGenderRow>;
type StatsRowSectionProps = React.ComponentProps<typeof StatsRow>;
type MovesAndIVSectionProps = React.ComponentProps<typeof MovesAndIV>;
type MetaPanelSectionProps = React.ComponentProps<typeof MetaPanel>;

interface InstanceDetailsLayoutProps {
  className?: string;
  dateCaught: string | null;
  headerRow: HeaderRowSectionProps;
  backgroundSelector: BackgroundSelectorSectionProps;
  imageStage: ImageStageSectionProps;
  identityRow: IdentityRowSectionProps;
  levelGenderRow: LevelGenderRowSectionProps;
  statsRow: StatsRowSectionProps;
  movesAndIV: MovesAndIVSectionProps;
  metaPanel: MetaPanelSectionProps;
  levelArcLevel: number | null;
  arcLayerRef?: React.Ref<HTMLDivElement>;
  powerContent?: React.ReactNode;
  postPowerContent?: React.ReactNode;
  showPowerDivider?: boolean;
  footerContent?: React.ReactNode;
  showStatsDivider?: boolean;
  showMetaDivider?: boolean;
  showMetaPanel?: boolean;
  showBackgroundSelectorRow?: boolean;
  showLevelGenderRow?: boolean;
  addStatsBottomGap?: boolean;
}

const InstanceDetailsLayout: React.FC<InstanceDetailsLayoutProps> = ({
  className = 'caught-instance',
  dateCaught,
  headerRow,
  backgroundSelector,
  imageStage,
  identityRow,
  levelGenderRow,
  statsRow,
  movesAndIV,
  metaPanel,
  levelArcLevel,
  arcLayerRef,
  powerContent = null,
  postPowerContent = null,
  showPowerDivider = false,
  footerContent = null,
  showStatsDivider = true,
  showMetaDivider = true,
  showMetaPanel = true,
  showBackgroundSelectorRow = true,
  showLevelGenderRow = true,
  addStatsBottomGap = false,
}) => (
  <div className={className}>
    {dateCaught ? <CaughtDateRibbon dateCaught={dateCaught} /> : null}

    <div className="instance-details-body">
      <HeaderRow {...headerRow} />

      {showBackgroundSelectorRow ? <BackgroundSelector {...backgroundSelector} /> : null}

      {levelArcLevel !== null ? (
        <div className="level-arc-layer" aria-hidden="true" ref={arcLayerRef}>
          <div className="level-arc-overlay">
            <LevelArc level={levelArcLevel} fitToContainer />
          </div>
        </div>
      ) : null}

      <ImageStage {...imageStage} />

      <IdentityRow {...identityRow} />

      {showLevelGenderRow ? <LevelGenderRow {...levelGenderRow} /> : null}

      <StatsRow {...statsRow} addBottomGap={addStatsBottomGap} />

      {showStatsDivider ? <div className="caught-stats-divider" aria-hidden="true" /> : null}

      {powerContent}

      {postPowerContent}

      {showPowerDivider ? <div className="caught-power-divider" aria-hidden="true" /> : null}

      <MovesAndIV {...movesAndIV} />

      {showMetaPanel ? <MetaPanel {...metaPanel} showDivider={showMetaDivider} /> : null}

      {footerContent}
    </div>
  </div>
);

export default InstanceDetailsLayout;
