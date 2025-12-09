module UpdateJudgement where

import Prelude
import Effect (Effect)
import Data.Argonaut.Core (Json)

import Model

foreign import data UpdateMe :: Type

foreign import updateJudgement :: forall rj. rj -> Effect Unit
