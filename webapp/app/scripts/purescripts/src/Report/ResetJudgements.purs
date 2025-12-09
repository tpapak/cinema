module ResetJudgements where

import Prelude
import Effect 

-- foreign import data RESET_JUDGEMENTS :: Effect -- REMOVED: Old effect type

foreign import resetJudgements :: forall eff. 
    Effect Unit
