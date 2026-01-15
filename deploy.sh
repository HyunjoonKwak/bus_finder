#!/bin/bash

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

GHCR_USERNAME="${GHCR_USERNAME:-hyunjoonkwak}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
COMPOSE_FILE="docker-compose.prod.yml"

print_header() {
    echo -e "${BLUE}================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}================================${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

ghcr_login() {
    print_header "🔐 GHCR 로그인"

    echo -e "${YELLOW}GitHub Personal Access Token이 필요합니다.${NC}"
    echo ""

    read -p "GitHub 사용자명 [$GHCR_USERNAME]: " input_username
    GHCR_USERNAME="${input_username:-$GHCR_USERNAME}"

    echo -e "${YELLOW}토큰을 입력하세요:${NC}"
    read -s token
    echo ""

    echo "$token" | docker login ghcr.io -u "$GHCR_USERNAME" --password-stdin

    if [ $? -eq 0 ]; then
        print_success "GHCR 로그인 성공!"
    else
        print_error "GHCR 로그인 실패"
        exit 1
    fi
}

pull_images() {
    print_header "📥 GHCR 이미지 풀"

    echo -e "${YELLOW}GHCR 사용자: ${GHCR_USERNAME}${NC}"
    echo -e "${YELLOW}이미지 태그: ${IMAGE_TAG}${NC}"
    echo ""

    echo -e "${BLUE}이미지 풀 중...${NC}"
    docker pull ghcr.io/${GHCR_USERNAME}/bus_finder:${IMAGE_TAG}

    print_success "이미지 풀 완료!"
}

deploy() {
    print_header "🚀 Bus Finder 배포"

    echo -e "${YELLOW}기존 컨테이너 중지 중...${NC}"
    GHCR_USERNAME=${GHCR_USERNAME} IMAGE_TAG=${IMAGE_TAG} docker-compose -f ${COMPOSE_FILE} down || true

    echo -e "${YELLOW}컨테이너 시작 중...${NC}"
    GHCR_USERNAME=${GHCR_USERNAME} IMAGE_TAG=${IMAGE_TAG} docker-compose -f ${COMPOSE_FILE} up -d

    print_success "배포 완료!"
    echo ""
    status
}

update() {
    print_header "🔄 Bus Finder 업데이트"

    pull_images
    echo ""
    deploy
}

start() {
    print_header "▶️  Bus Finder 시작"

    GHCR_USERNAME=${GHCR_USERNAME} IMAGE_TAG=${IMAGE_TAG} docker-compose -f ${COMPOSE_FILE} up -d

    print_success "시작 완료!"
    status
}

stop() {
    print_header "⏹️  Bus Finder 중지"

    GHCR_USERNAME=${GHCR_USERNAME} IMAGE_TAG=${IMAGE_TAG} docker-compose -f ${COMPOSE_FILE} stop

    print_success "중지 완료!"
}

restart() {
    print_header "🔄 Bus Finder 재시작"

    GHCR_USERNAME=${GHCR_USERNAME} IMAGE_TAG=${IMAGE_TAG} docker-compose -f ${COMPOSE_FILE} restart

    print_success "재시작 완료!"
    status
}

status() {
    print_header "📊 Bus Finder 상태"

    GHCR_USERNAME=${GHCR_USERNAME} IMAGE_TAG=${IMAGE_TAG} docker-compose -f ${COMPOSE_FILE} ps

    echo ""
    echo -e "${BLUE}🌐 접속 URL:${NC}"
    echo "  http://$(hostname -I 2>/dev/null | awk '{print $1}' || echo 'localhost'):3400"
}

logs() {
    local service=$1

    # UTC -> KST 변환 (9시간 추가) - awk 사용
    convert_to_kst() {
        awk '{
            if (match($0, /[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}/)) {
                ts = substr($0, RSTART, RLENGTH)
                gsub(/T/, " ", ts)
                cmd = "date -d \"" ts " UTC\" +\"%Y-%m-%d %H:%M:%S\" 2>/dev/null"
                cmd | getline kst
                close(cmd)
                if (kst != "") {
                    sub(/[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]+Z/, kst)
                }
            }
            print
        }'
    }

    if [ -z "$service" ]; then
        print_header "📝 전체 로그 (KST)"
        GHCR_USERNAME=${GHCR_USERNAME} IMAGE_TAG=${IMAGE_TAG} docker-compose -f ${COMPOSE_FILE} logs -tf --tail=100 | convert_to_kst
    else
        print_header "📝 $service 로그 (KST)"
        GHCR_USERNAME=${GHCR_USERNAME} IMAGE_TAG=${IMAGE_TAG} docker-compose -f ${COMPOSE_FILE} logs -tf --tail=100 "$service" | convert_to_kst
    fi
}

clean() {
    print_header "🧹 Docker 정리"

    echo -e "${YELLOW}컨테이너 삭제 중...${NC}"
    GHCR_USERNAME=${GHCR_USERNAME} IMAGE_TAG=${IMAGE_TAG} docker-compose -f ${COMPOSE_FILE} down -v || true

    echo -e "${YELLOW}사용하지 않는 이미지 삭제 중...${NC}"
    docker image prune -f

    print_success "정리 완료!"
}

show_help() {
    echo -e "${GREEN}Bus Finder NAS 배포 스크립트${NC}"
    echo ""
    echo -e "${YELLOW}사용법:${NC}"
    echo "  $0 <명령어> [옵션]"
    echo ""
    echo -e "${BLUE}=== 배포 ===${NC}"
    echo -e "  ${GREEN}login${NC}            GHCR 로그인 (최초 1회)"
    echo -e "  ${GREEN}pull${NC}             GHCR에서 최신 이미지 풀"
    echo -e "  ${GREEN}deploy${NC}           컨테이너 배포"
    echo -e "  ${GREEN}update${NC}           풀 + 배포 (추천)"
    echo ""
    echo -e "${BLUE}=== 관리 ===${NC}"
    echo -e "  ${GREEN}start${NC}            서비스 시작"
    echo -e "  ${GREEN}stop${NC}             서비스 중지"
    echo -e "  ${GREEN}restart${NC}          서비스 재시작"
    echo -e "  ${GREEN}status${NC}           서비스 상태"
    echo -e "  ${GREEN}logs${NC}             로그 확인"
    echo ""
    echo -e "${BLUE}=== 유지보수 ===${NC}"
    echo -e "  ${GREEN}clean${NC}            Docker 정리"
    echo ""
    echo -e "${YELLOW}환경변수:${NC}"
    echo "  GHCR_USERNAME    GitHub 사용자명 (기본: hyunjoonkwak)"
    echo "  IMAGE_TAG        이미지 태그 (기본: latest)"
    echo ""
    echo -e "${YELLOW}예시:${NC}"
    echo "  $0 login                    # GHCR 로그인"
    echo "  $0 update                   # 최신 이미지로 업데이트"
    echo "  IMAGE_TAG=v1.0.0 $0 update  # 특정 버전으로 업데이트"
}

case "${1:-help}" in
    login)
        ghcr_login
        ;;
    pull)
        pull_images
        ;;
    deploy)
        deploy
        ;;
    update)
        update
        ;;
    start)
        start
        ;;
    stop)
        stop
        ;;
    restart)
        restart
        ;;
    status)
        status
        ;;
    logs)
        logs "$2"
        ;;
    clean)
        clean
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        print_error "알 수 없는 명령어: $1"
        echo ""
        show_help
        exit 1
        ;;
esac
