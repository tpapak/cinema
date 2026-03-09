module DownloadJudgements where

import Prelude
import Effect

-- foreign import data DOWNLOAD_JUDGEMENTS :: Effect -- REMOVED: Old effect type

foreign import downloadJudgements
  :: forall eff
   . Effect Unit
