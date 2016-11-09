SetupCtr.$inject = ['$scope', '$rootScope', '$location', 'restApi', '$mdToast'];

export default function SetupCtr($scope, $rootScope, $location, restApi, $mdToast) {

    $scope.installationFinished = false;
    $scope.installationSuccessful = false;
    $scope.installationResults = [{}];
    $scope.loading = false;


    $scope.setup = {
        couchDbHost: $location.host(),
        couchDbProtocol: 'http',
        couchDbPort: 5984,
        couchDbUserDbName: 'users',
        couchDbPipelineDbName: 'pipeline',
        couchDbConnectionDbName: 'connection',
        couchDbMonitoringDbName: 'monitoring',
        couchDbNotificationDbName: 'notification',
        sesameUrl: 'http://' + $location.host() + ':8030/openrdf-sesame',
        sesameDbName: 'test-6',
        kafkaProtocol: 'http',
        kafkaHost: $location.host(),
        kafkaPort: 9092,
        zookeeperProtocol: 'http',
        zookeeperHost: $location.host(),
        zookeeperPort: 2181,
        jmsProtocol: 'tcp',
        jmsHost: $location.host(),
        jmsPort: 61616,
        adminUsername: '',
        adminEmail: '',
        adminPassword: '',
        streamStoryUrl: 'http://' + $location.host() + '/streamstory',
        panddaUrl: 'http://' + $location.host() + ':90/pandda_v2_2',
        hippoUrl: 'http://' + $location.host() + '/kpimodeller',
        humanInspectionReportUrl: '',
        humanMaintenanceReportUrl: '',
        appConfig: 'ProaSense',
        marketplaceUrl: '',
        podUrls: []
    };

    $scope.configure = function () {
        $scope.loading = true;
        restApi.setupInstall($scope.setup).success(function (data) {
            $scope.installationResults = data;

            restApi.configured()
                .then(function (response) {
                    if (response.data.configured) {
                        $rootScope.appConfig = response.data.appConfig;
                        $scope.installationFinished = true;
                        $scope.loading = false;
                    }
                }).error(function (data) {
                $scope.loading = false;
                $scope.showToast("Fatal error, contact administrator");
            });
        });
    }

    $scope.showToast = function (string) {
        $mdToast.show(
            $mdToast.simple()
                .content(string)
                .position("right")
                .hideDelay(3000)
        );
    };

    $scope.addPod = function (podUrls) {
        if (podUrls == undefined) podUrls = [];
        podUrls.push("localhost");
    }

    $scope.removePod = function (podUrls, index) {
        podUrls.splice(index, 1);
    }
};
