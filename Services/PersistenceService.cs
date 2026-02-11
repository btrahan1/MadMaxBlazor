using System.Text.Json;
using Microsoft.JSInterop;
using MadMaxBlazor.Services;

namespace MadMaxBlazor.Services
{
    public class PersistenceService
    {
        private readonly IJSRuntime _jsRuntime;
        private const string SaveKey = "MadMaxBlazor_SaveData";

        public PersistenceService(IJSRuntime jsRuntime)
        {
            _jsRuntime = jsRuntime;
        }

        public async Task SaveGame(GameState state)
        {
            var json = JsonSerializer.Serialize(state);
            await _jsRuntime.InvokeVoidAsync("localStorage.setItem", SaveKey, json);
            Console.WriteLine("Game Saved.");
        }

        public async Task<GameState?> LoadGame()
        {
            try
            {
                var json = await _jsRuntime.InvokeAsync<string?>("localStorage.getItem", SaveKey);
                if (string.IsNullOrEmpty(json)) return null;
                return JsonSerializer.Deserialize<GameState>(json);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Load error: {ex.Message}");
                return null;
            }
        }

        public async Task ClearSave()
        {
            await _jsRuntime.InvokeVoidAsync("localStorage.removeItem", SaveKey);
            Console.WriteLine("Save Cleared.");
        }
    }
}
