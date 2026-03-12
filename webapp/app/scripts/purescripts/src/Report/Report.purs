-- | Report module — rendering entry point.
-- |
-- | The old `render :: Json -> String` function used Handlebars to produce HTML.
-- | It has been replaced by the JS-side reportView.js (hyperscript-helpers).
-- | The JS router now calls Report.View.viewData directly for the data,
-- | then passes it to reportView() for VNode rendering.
module Report where

import Prelude
-- import Data.Maybe (Maybe(..))
-- import Data.Either (Either(..))
-- import Effect (Effect)
-- import Effect.Console (log, logShow)
-- import Control.Monad.Except (runExcept)
-- import Data.Argonaut (Json)
-- import Data.Newtype
-- import Data.Lens
-- import Data.Lens.Fold
-- import Data.Lens.Fold.Partial
-- import Data.Lens.Grate
-- import Data.Lens.Index
-- import Data.Lens.Lens
-- import Data.Lens.Record
-- import Data.Lens.Setter
-- import Data.Lens.Zoom

-- import Model
-- import StudyLimitationsModel
-- import Report.View as V

-- render :: Json -> String
-- render m = do
--   let rs = readState m
--   case rs of
--     Left a -> "<div class='error-cont error col-md-offset-1 col-md-10'>" <> show a <> "</div>"
--     Right b -> V.template b
