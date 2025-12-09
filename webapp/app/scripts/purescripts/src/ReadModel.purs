module ReadModel where

import Prelude
import Effect
import Data.Argonaut.Core (Json)

foreign import data ModelIn :: Type

-- foreign import data READ_STATE :: Effect -- REMOVED: Old effect type

foreign import readModel :: Effect Json
