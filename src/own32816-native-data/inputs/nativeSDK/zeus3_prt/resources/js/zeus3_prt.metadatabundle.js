var zeus3_prt;
(function (zeus3_prt){
    var MetaDataBundle = (function() {
        function MetaDataBundle() {
        }

        MetaDataBundle.prototype.isDebugEnabled = function(){
            return "false".toLowerCase() === "true" ;
        };

        MetaDataBundle.prototype.isGaffingEnabled = function(){
            return "false".toLowerCase() === "true" ;
        };

        MetaDataBundle.prototype.getResourceVersion = function(){
            return "5.0.4.1-1787670669";
        };

        MetaDataBundle.prototype.getLocale = function(){
            return "en_US";
        };

        MetaDataBundle.prototype.isDemoEnabled = function(){
            return "false".toLowerCase() === "true" ;
        };

        MetaDataBundle.prototype.getWebaudio = function(){
            return "true".toLowerCase() === "true" ;
        };

        MetaDataBundle.prototype.isRealMoney = function() {
            return "false".toLowerCase() === "true" ;
        };

        MetaDataBundle.prototype.getGameCode = function() {
            return "zeus3_prt";
        };

        MetaDataBundle.prototype.getCdnRoot = function() {
            return "https://d10ml311dd14ci.cloudfront.net/5.0.4.1-1787670669/resource-service";
        };

        MetaDataBundle.prototype.getLogicUrl = function() {
            return "https://gls.atc.casinarena.com/gls.rgsx";
        };

        MetaDataBundle.prototype.getCountryCode = function(){
            return "US";
        };

        MetaDataBundle.prototype.getMaxWinStatus = function() {
            return "ON".toLowerCase() === "on";
        };

        MetaDataBundle.prototype.getAutoplayStatus = function() {
            return "ON".toLowerCase() !== "off";
        };

        MetaDataBundle.prototype.getSkillStopStatus = function() {
            return "${skillstop}".toLowerCase() === "on";
            //return true;
        };

        MetaDataBundle.prototype.getPartnerCode = function() {
            return "nyx_draftkings_nj".toLowerCase();
        }

        return MetaDataBundle;
    })();

    zeus3_prt.MetaDataBundle = MetaDataBundle;

})(zeus3_prt || (zeus3_prt = {}));
