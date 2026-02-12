using System;

namespace MadMaxBlazor.Services
{
    public class Item
    {
        public string Id { get; set; } = Guid.NewGuid().ToString();
        public string Name { get; set; } = "";
        public string Description { get; set; } = "";
        public string Slot { get; set; } = "NONE"; // HEAD, CHEST, LEGS, MAIN, OFF, NONE
        public int Cost { get; set; } = 0;
        public int BaseDamage { get; set; } = 0;
        
        // Stats
        public int BonusStr { get; set; } = 0;
        public int BonusDex { get; set; } = 0;
        public int BonusCon { get; set; } = 0;
        public int BonusInt { get; set; } = 0;
        
        public string GetIcon()
        {
            return Slot switch
            {
                "HEAD" => "🪖",
                "CHEST" => "👕",
                "BACK" => "🎒",
                "LEGS" => "👖",
                "FEET" => "👞",
                "MAIN" => "🗡️",
                "OFF" => "🛡️",
                "GLOVES" => "🧤",
                _ => "📦"
            };
        }
    }
}
