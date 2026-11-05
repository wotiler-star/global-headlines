// Wikimedia Commons 真实照片署名（CC BY / CC BY-SA 要求可见署名）
// 数据来源：public/original/CREDITS.json；cov55 起由 build_images_cov55.py 全量重建
export type ImageCredit = { artist: string; license: string; url: string };

export const IMAGE_CREDITS: Record<string, ImageCredit> = {
  "/original/spatial-glasses-cover.webp": { artist: "Xuthoria", license: "CC BY-SA 4.0", url: "https://commons.wikimedia.org/wiki/File%3AWAIC_2025_-_Alibaba_Quark_Glasses_01.jpg" },
  "/original/spatial-glasses-fig1.webp": { artist: "Axrxax", license: "CC BY-SA 4.0", url: "https://commons.wikimedia.org/wiki/File%3AVuzix_Blade.jpg" },
  "/original/spatial-glasses-fig2.webp": { artist: "Wikimedia Commons user C.Suthorn.", license: "CC BY-SA 4.0", url: "https://commons.wikimedia.org/wiki/File%3AAugmented_Reality_Headset_02.jpg" },
  "/original/edge-ai-chip-cover.webp": { artist: "Ingo Dierking", license: "CC BY-SA 4.0", url: "https://commons.wikimedia.org/wiki/File%3AMacro_circuit_board.JPG" },
  "/original/edge-ai-chip-fig1.webp": { artist: "Ashley Pomeroy", license: "CC BY 4.0", url: "https://commons.wikimedia.org/wiki/File%3APrinted_Circuit_Board_9990.jpg" },
  "/original/edge-ai-chip-fig2.webp": { artist: "Dmitriy Nosachev", license: "CC BY-SA 4.0", url: "https://commons.wikimedia.org/wiki/File%3APro_Micro_MCU_board.jpg" },
  "/original/car-ai-cover.webp": { artist: "Coolomon Tetris (also known as CoolT)", license: "CC BY-SA 4.0", url: "https://commons.wikimedia.org/wiki/File%3ATesla_Model_3_interior.jpg" },
  "/original/car-ai-fig1.webp": { artist: "Shixart1985", license: "CC BY 2.0", url: "https://commons.wikimedia.org/wiki/File%3ASmartphone_mounted_on_car_dashboard_during_a_drive_in_a_modern_vehicle_with_a_focus_on_navigation_use.jpg" },
  "/original/car-ai-fig2.webp": { artist: "Ivan Radic", license: "CC BY 2.0", url: "https://commons.wikimedia.org/wiki/File%3AClose-up_of_engine_oil_temperature_gauge_on_car_dashboard_%2849006320293%29.jpg" },
  "/original/rna-model-cover.webp": { artist: "Scotted400", license: "CC BY 3.0", url: "https://commons.wikimedia.org/wiki/File:Ion_Proton_Sequencers,_BGI_Shenzhen.JPG" },
  "/original/rna-model-fig1.webp": { artist: "J.N. Eskra", license: "CC BY-SA 4.0", url: "https://commons.wikimedia.org/wiki/File:Laboratory_pipettes.jpg" },
  "/original/rna-model-fig2.webp": { artist: "Gannu03", license: "CC BY-SA 4.0", url: "https://commons.wikimedia.org/wiki/File:Laboratory_microcentrifuge_tubes_and_pipette_tips_01.jpg" },
  "/original/enamel-gel-cover.webp": { artist: "Genusfotografen (Tomas Gunnarsson) / Wikimedia", license: "CC BY-SA 4.0", url: "https://commons.wikimedia.org/wiki/File:Adult_human_teeth.jpg" },
  "/original/enamel-gel-fig1.webp": { artist: "Shixart1985", license: "CC BY 2.0", url: "https://commons.wikimedia.org/wiki/File:Dental_tools_and_equipment_arranged_neatly_on_a_clinical_workstation_at_a_modern_dental_clinic.jpg" },
  "/original/enamel-gel-fig2.webp": { artist: "Shixart1985", license: "CC BY 2.0", url: "https://commons.wikimedia.org/wiki/File:Dental_treatment_room_featuring_equipment_and_a_chair_in_a_modern_clinic.jpg" },
  "/original/6g-prototype-cover.webp": { artist: "Mnalis", license: "CC BY-SA 4.0", url: "https://commons.wikimedia.org/wiki/File:Cell_tower_antenna,_Zagreba%C4%8Dka_cesta.jpg" },
  "/original/6g-prototype-fig1.webp": { artist: "Kernow Skies", license: "CC BY-SA 3.0", url: "https://commons.wikimedia.org/wiki/File:Zoomed_in_shot_of_mobile_phone_mast.jpg" },
  "/original/6g-prototype-fig2.webp": { artist: "Kevin Kandlbinder", license: "CC BY 4.0", url: "https://commons.wikimedia.org/wiki/File:Cell_Tower_in_Stykkish%C3%B3lmur.jpg" },
};
