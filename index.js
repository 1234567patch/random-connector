// extensions/random-connector/index.js

// SillyTavern import
import { eventSource, event_types } from '../../script.js';
import { getContext, loadExtensionSettings, saveExtensionSettings } from '../../../extensions.js';
import { SlashCommandParser } from '../../slash-commands/SlashCommandParser.js';

const extensionName = "random-connector";
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;

let extensionSettings = extension_settings[extensionName];
if (!extensionSettings) {
    extensionSettings = {};
    extension_settings[extensionName] = extensionSettings;
}


// 기본 설정값
const defaultSettings = {
    enabled: false,
    includedProfiles: [], // 랜덤 선택에 포함될 프로필 이름 배열
};

// 확장 기능의 현재 설정을 저장할 변수
let settings = { ...defaultSettings };

async function getProfileListFromCommand() {
    try {
        // '/profile-list' 커맨드가 존재하는지 확인 (connection-manager 활성화 여부 체크)
        if (!SlashCommandParser.commands['profile-list']) {
             console.error("Random Connector: '/profile-list' command not found. Is Connection Manager enabled?");
             toastr.error("Connection Manager extension not found or '/profile-list' command is unavailable.");
             return []; // 빈 배열 반환
        }

        // '/profile-list' 커맨드 실행 (결과는 JSON 문자열)
        const resultJson = await SlashCommandParser.executeCommand('/profile-list');

        if (resultJson) {
            // JSON 문자열을 파싱하여 배열로 변환
            const profileNames = JSON.parse(resultJson);
            return Array.isArray(profileNames) ? profileNames : [];
        } else {
            console.warn("Random Connector: '/profile-list' command returned empty result.");
            return [];
        }
    } catch (error) {
        console.error("Random Connector: Error executing or parsing '/profile-list' command:", error);
        toastr.error("Failed to get profile list from Connection Manager.");
        return []; // 오류 발생 시 빈 배열 반환
    }
}

async function loadProfileUsingCommand(profileName) {
    try {
         // '/profile' 커맨드가 존재하는지 확인
        if (!SlashCommandParser.commands['profile']) {
             console.error("Random Connector: '/profile' command not found. Is Connection Manager enabled?");
             toastr.error("Connection Manager extension not found or '/profile' command is unavailable.");
             return false; // 실패 의미
        }

        // '/profile 프로필이름 await=true' 형태로 커맨드 실행
        // await=true를 추가하여 프로필 적용이 완료될 때까지 기다리도록 요청
        const commandString = `/profile "${profileName}" await=true`; // 이름에 공백이 있을 수 있으므로 따옴표 추가
        console.log(`Random Connector: Executing command: ${commandString}`);
        const result = await SlashCommandParser.executeCommand(commandString);

        // 성공 시 보통 프로필 이름이 반환되거나, 실패 시 빈 문자열 또는 에러 발생
        if (result === profileName) {
             console.log(`Random Connector: Command '/profile ${profileName}' executed successfully.`);
             return true; // 성공 의미
        } else {
             console.warn(`Random Connector: Command '/profile ${profileName}' might have failed or returned unexpected result:`, result);
             // 결과가 다르더라도 오류가 없었다면 성공으로 간주할 수도 있음 (connection-manager 구현에 따라 다름)
             // 여기서는 일단 실패로 간주
             toastr.error(`Failed to apply profile "${profileName}" via command.`);
             return false;
        }
    } catch (error) {
        console.error(`Random Connector: Error executing '/profile ${profileName}' command:`, error);
        toastr.error(`Failed to apply profile "${profileName}" due to an error.`);
        return false; // 오류 발생 시 실패 의미
    }
}

// 설정 UI를 로드하고 초기화하는 함수
async function loadSettingsUI() {
    // 설정 HTML 로드 (필요한 경우 - 여기서는 동적 생성을 가정)
    // $('#random-connector-settings-content').load(`${extensionFolderPath}/settings.html`);
    
    try {
        profileList = await getProfileListFromCommand();
        // 에러는 getProfileListFromCommand 내부에서 처리되고 빈 배열이 반환될 수 있음
        if (!profileList) { // 만약을 위해 null/undefined 체크 추가 (선택 사항)
            profileList = [];
        }
    } catch (error) {
        // getProfileListFromCommand 에서 자체 처리하므로 여기까지 오지 않을 수 있지만,
        // 만약을 대비한 최상위 catch 는 유지해도 좋음
        console.error("Random Connector: Unexpected error fetching profile list:", error);
        toastr.error("Failed to get connection profiles due to an unexpected error.");
        return; // UI 생성 중단
    }


    const profilesContainer = document.getElementById('random-connector-profiles');
    if (!profilesContainer) {
        console.error('Random Connector: Profiles container element not found in settings HTML.');
        return;
    }
    profilesContainer.innerHTML = ''; // 기존 목록 초기화

    if (profileList.length === 0) {
        profilesContainer.innerHTML = '<p>No connection profiles found. Please create some in the Connection Manager extension first.</p>';
    } else {
        profileList.forEach(profileName => {
            const checkboxId = `rc-profile-${profileName.replace(/[^a-zA-Z0-9]/g, '_')}`; // 고유 ID 생성 (특수문자 처리)
            const isChecked = settings.includedProfiles.includes(profileName);

            const div = document.createElement('div');
            div.classList.add('rc-profile-item'); // 스타일링을 위한 클래스 추가 (선택사항)

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = checkboxId;
            checkbox.value = profileName;
            checkbox.checked = isChecked;

            const label = document.createElement('label');
            label.htmlFor = checkboxId;
            label.textContent = profileName;

            // 체크박스 변경 시 settings.includedProfiles 실시간 업데이트
            checkbox.addEventListener('change', (event) => {
                const name = event.target.value;
                if (event.target.checked) {
                    if (!settings.includedProfiles.includes(name)) {
                        settings.includedProfiles.push(name);
                    }
                } else {
                    settings.includedProfiles = settings.includedProfiles.filter(p => p !== name);
                }
                // 변경사항을 즉시 저장하도록 하려면 여기서 saveSettings() 호출 가능
                // saveSettings();
                console.log('Random Connector: Included profiles updated:', settings.includedProfiles);
            });

            div.appendChild(checkbox);
            div.appendChild(label);
            profilesContainer.appendChild(div);
        });
    }

    // 활성화 토글 상태 설정
    const enabledToggle = document.getElementById('random-connector-enabled');
    if (enabledToggle) {
        enabledToggle.checked = settings.enabled;
    } else {
         console.error('Random Connector: Enable toggle element not found in settings HTML.');
    }
}

// 설정 저장 함수
function saveSettings() {
    const enabledToggle = document.getElementById('random-connector-enabled');
    if (enabledToggle) {
        settings.enabled = enabledToggle.checked;
    }
    // includedProfiles는 체크박스 핸들러에서 이미 업데이트됨

    saveExtensionSettings(extensionName, settings); // SillyTavern 유틸리티 사용
    console.log("Random Connector: Settings saved.", settings);
    toastr.success("Random Connector settings saved.");
}

// AI 응답 생성이 완료된 후 실행될 핵심 로직 함수
async function onGenerationEnded(data) {
    // data 객체는 보통 생성된 메시지 정보 등을 포함하지만, 여기서는 사용 안 함.
    console.log("Random Connector: Generation ended event received.");

    // 확장 기능 비활성화 상태이거나, 포함된 프로필이 없으면 아무것도 안 함
    if (!settings.enabled || settings.includedProfiles.length === 0) {
        console.log("Random Connector: Disabled or no profiles selected. Skipping.");
        return;
    }

    // 이미 프로필 변경 중이거나 다른 작업 중일 때 중복 실행 방지 (선택적)
    // if (window.isRandomConnectorBusy) return;
    // window.isRandomConnectorBusy = true;

    console.log("Random Connector: Preparing to select next connection profile...");

    try {
        // 최신 프로필 목록 확인
        let availableProfiles = await getProfileListFromCommand();
        if (!availableProfiles) availableProfiles = []; // null/undefined 방지
    
        // 설정에서 선택되었고, 현재 실제로 존재하는 프로필만 필터링
        const validProfilesToChoose = settings.includedProfiles.filter(name => availableProfiles.includes(name));

        if (validProfilesToChoose.length === 0) {
            console.warn("Random Connector: No valid profiles available for random selection among included ones.");
            // window.isRandomConnectorBusy = false; // 플래그 해제
            return;
        }

        // 랜덤 프로필 선택
        const randomIndex = Math.floor(Math.random() * validProfilesToChoose.length);
        const selectedProfileName = validProfilesToChoose[randomIndex];

        console.log(`Random Connector: Randomly selected "${selectedProfileName}" for the next turn.`);

        // Connection Manager 함수를 사용해 선택된 프로필 로드 (다음 턴 준비)

        const success = await loadProfileUsingCommand(selectedProfileName); // 변경된 코드
        if (success) {
           console.log(`Random Connector: Profile "${selectedProfileName}" loaded successfully via command.`);
           toastr.info(`Next connector set to: ${selectedProfileName}`, 'Random Connector', { timeOut: 2500 });
        } else {
            console.error(`Random Connector: Failed to load profile "${selectedProfileName}" using command.`);
            // 실패 시 사용자에게 알림 (loadProfileUsingCommand 내부에서도 알림)
        }

    } catch (error) {
        console.error("Random Connector: Error during profile selection/loading:", error);
        toastr.error("Random Connector: Failed to set next profile due to an error.");
    } finally {
        // window.isRandomConnectorBusy = false; // 작업 완료 후 플래그 해제 (선택적)
    }
}

// 확장 기능 로드 시 실행될 초기화 함수
async function onExtensionLoaded() {
    try {
        // 저장된 설정 로드 (없으면 defaultSettings 사용)
        settings = await loadExtensionSettings(extensionName, defaultSettings);
        console.log("Random Connector: Settings loaded.", settings);

        // 설정 UI 로드 및 초기화
        await loadSettingsUI();

        // 설정 UI 이벤트 리스너 등록
        const saveButton = document.getElementById('random-connector-save');
        if (saveButton) {
            saveButton.addEventListener('click', saveSettings);
        } else {
            console.error('Random Connector: Save button element not found in settings HTML.');
        }

        const enabledToggle = document.getElementById('random-connector-enabled');
        if (enabledToggle) {
             // 활성화 토글 변경 시 즉시 settings 객체 업데이트 (저장은 'Save' 버튼 클릭 시)
            enabledToggle.addEventListener('change', (event) => {
                settings.enabled = event.target.checked;
                console.log(`Random Connector: ${settings.enabled ? 'Enabled' : 'Disabled'}. Save settings to persist.`);
            });
        }

        console.log("Random Connector: Extension loaded and initialized.");

    } catch (error) {
        console.error("Random Connector: Error during extension loading:", error);
        toastr.error("Random Connector failed to load properly.");
    }
}

// SillyTavern 이벤트 리스너 등록
eventSource.on(event_types.EXTENSION_LOADED, onExtensionLoaded);
eventSource.on(event_types.GENERATION_ENDED, onGenerationEnded); // AI 응답 완료 시 실행될 함수 등록