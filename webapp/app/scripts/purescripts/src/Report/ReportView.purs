module Report.View where

import Prelude
-- import Effect
-- import Effect.Unsafe
-- import Effect.Console (log, logShow)
-- import Data.Array
-- import Data.String as S
import Data.Argonaut (Json)
-- import Data.Argonaut.Decode.Class (class DecodeJson, decodeJson)
-- import Data.Argonaut.Encode.Class (class EncodeJson, encodeJson)
-- import Data.Argonaut.Decode.Generic (genericDecodeJson)
-- import Data.Generic.Rep as Rep
-- import Data.Show.Generic (genericShow)
-- import Control.Monad.Except (runExcept)
-- import Data.Function
-- import Data.Either (Either(..))
-- import Data.Traversable
-- import Handlebars (compile) -- REMOVED: No longer using Handlebars
import Data.Lens

-- import Report.Template as T -- REMOVED: No longer using Handlebars template
import Model
-- import Text.Model
-- import StudyLimitationsModel
-- import ComparisonModel
-- import InconsistencyModel
-- import ImprecisionModel
-- import IndirectnessModel
-- import PubbiasModel
import Report.Model
import Report.Update as RU

register :: forall e. Json -> Unit
register s = unit

isReady :: State -> Boolean
isReady st =
  ( st ^. _State <<< project <<< _Project
      <<< report
      <<< _Report
  )."status" == "ready"

type ViewModel r =
  { isReady :: Boolean
  , directRows :: Array ReportRow
  , indirectRows :: Array ReportRow
  , hasDirects :: Boolean
  , hasIndirects :: Boolean
  | r
  }

-- | Build the view data record for the report.
-- | The JS-side reportView.js (hyperscript-helpers) renders this to VNodes.
viewData :: State -> ViewModel (project :: Project)
viewData a =
  { project: a ^. _State <<< project
  , isReady: isReady a
  , directRows: RU.directRows a
  , indirectRows: RU.indirectRows a
  , hasDirects: RU.hasDirects a
  , hasIndirects: RU.hasIndirects a
  }
