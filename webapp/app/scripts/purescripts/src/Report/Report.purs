module Report where

import Prelude
import Data.Maybe (Maybe(..))
import Data.Either (Either(..))
import Effect (Effect)
import Effect.Console (log, logShow)
import Control.Monad.Except (runExcept)
import Data.Argonaut (Json)
import Data.Newtype
import Data.Lens
import Data.Lens.Fold
import Data.Lens.Fold.Partial
import Data.Lens.Grate
import Data.Lens.Index
import Data.Lens.Lens
import Data.Lens.Record
import Data.Lens.Setter
import Data.Lens.Zoom

import Model
import StudyLimitationsModel
import Report.View as V

render :: Json -> String
render m = do
    let rs = readState m
    case rs of
     Left a -> V.errorTemplate a
     Right b -> V.template b
